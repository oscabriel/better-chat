import { env } from "cloudflare:workers";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelUsage } from "ai";
import {
	convertToModelMessages,
	generateId,
	stepCountIs,
	streamText,
} from "ai";
import { Hono } from "hono";
import { z } from "zod";
import {
	extractMessageText,
	MAX_MESSAGE_LENGTH,
	MAX_PROMPT_MESSAGES,
	mergeHistoryWithIncoming,
	resolveMessageId,
} from "@/server/ai/messages";
import { buildSystemPrompt } from "@/server/ai/prompts";
import { maybeGenerateConversationTitle } from "@/server/ai/title-generation";
import type { StoredUIMessage } from "@/server/lib/do";
import { requireUserDO, UnauthorizedError } from "@/server/lib/guard";
import {
	getModelDefinition,
	getModelFromId,
	getReasoningModel,
	validateModelAccess,
} from "@/server/lib/providers";
import {
	getCustomMcpServers,
	getUserSettingsRecord,
} from "@/server/lib/user-settings";
import {
	BUILT_IN_MCP_SERVERS,
	closeMCPClients,
	getMCPTools,
} from "@/server/mcp/client";
import {
	QuotaExceededError,
	recordUsage,
	requireAvailableQuota,
} from "@/server/utils/usage-service";

const aiRequestSchema = z.object({
	messages: z.array(z.any()),
	conversationId: z.string(),
	modelId: z.string().optional(),
});

export const aiRoutes = new Hono();

aiRoutes.post("/", async (c) => {
	try {
		const { userId, stub } = await requireUserDO(c);
		const body = aiRequestSchema.parse(await c.req.json());
		const { messages: uiMessages, conversationId } = body;

		// Get user settings including API keys for BYOK check
		const userSettings = await getUserSettingsRecord(userId);
		const modelId = body.modelId || userSettings.selectedModel;
		const provider = modelId.split(":")[0];

		await requireAvailableQuota(userId, provider, userSettings.apiKeys || {});

		const hasAccess = validateModelAccess(modelId, userSettings.apiKeys);
		if (!hasAccess) {
			return c.json(
				{
					error: "Model access denied - API key required for this model",
					modelId,
				},
				403,
			);
		}

		// Get model definition for usage tracking
		const modelDefinition = getModelDefinition(modelId);

		const customServers = await getCustomMcpServers(userId);
		const enabledBuiltInIds = userSettings.enabledMcpServers || [];

		// Inject environment-based headers for built-in servers
		const builtInWithHeaders = BUILT_IN_MCP_SERVERS.map((server) => {
			const headers: Record<string, string> = { ...(server.headers || {}) };

			return { ...server, headers };
		});

		// Combine built-in and custom enabled servers
		const enabledMCPServers = [
			...builtInWithHeaders.filter((server) =>
				enabledBuiltInIds.includes(server.id),
			),
			...customServers
				.filter((server) => server.enabled)
				.map((server) => ({
					id: server.id,
					name: server.name,
					url: server.url,
					type: server.type,
					description: server.description || "",
					headers: server.headers,
					isBuiltIn: false,
				})),
		];

		// Load MCP tools
		const { tools: mcpTools, clients } = await getMCPTools(enabledMCPServers);

		// Get user API key for BYOK models
		const userApiKey = userSettings.apiKeys?.[modelId.split(":")[0]];

		// Check if model supports reasoning and wrap with middleware
		const isReasoningModel =
			modelDefinition?.capabilities.includes("reasoning");

		const model = isReasoningModel
			? getReasoningModel(modelId, userApiKey)
			: getModelFromId(modelId, userApiKey);

		// Persist the last user message before generation
		const last = uiMessages[uiMessages.length - 1];
		if (last?.role === "user") {
			// Ensure conversation exists before appending
			await stub.upsertConversation(conversationId);
			// Store complete UIMessage directly (AI SDK v5 best practice)
			await stub.appendMessages(conversationId, [
				{
					...last,
					id: last.id || resolveMessageId(last.id, "user"),
					created: (last as { created?: number }).created || Date.now(),
				} as StoredUIMessage,
			]);
		}

		// Load conversation history from Durable Object (already in UIMessage format)
		const history = await stub.listMessages(
			conversationId,
			MAX_PROMPT_MESSAGES,
		);

		// Merge with incoming messages
		const mergedUiMessages = mergeHistoryWithIncoming(
			history.items,
			uiMessages,
		);

		// Convert to model messages
		const mergedForModel = mergedUiMessages.map((m) => ({
			role: m.role,
			parts: m.parts as Parameters<
				typeof convertToModelMessages
			>[0][number]["parts"],
			metadata: m.metadata,
		})) as Parameters<typeof convertToModelMessages>[0];

		// Build system prompt based on available tools and MCP servers
		const systemPrompt = buildSystemPrompt(mcpTools, enabledMCPServers);

		const result = streamText({
			model,
			system: systemPrompt,
			messages: convertToModelMessages(mergedForModel),
			// biome-ignore lint/suspicious/noExplicitAny: AI SDK tools type is complex and dynamically generated from MCP servers
			tools: Object.keys(mcpTools).length > 0 ? (mcpTools as any) : undefined,
			toolChoice: Object.keys(mcpTools).length > 0 ? "auto" : undefined,
			stopWhen: stepCountIs(5), // Allow up to 5 steps (tool calls + responses)
		});

		return result.toUIMessageStreamResponse({
			originalMessages: uiMessages,
			generateMessageId: () => generateId(),
			messageMetadata: ({
				part,
			}: {
				part: {
					type: string;
					usage?: LanguageModelUsage;
					totalUsage?: LanguageModelUsage;
				};
			}) => {
				// Add usage metadata for tracking
				// Note: 'finish' parts use 'totalUsage', while 'finish-step' parts use 'usage'
				const usageData = part.totalUsage || part.usage;

				if (part.type === "finish" && usageData) {
					const metadata = {
						usage: usageData,
						modelId,
					};
					return metadata;
				}
				return undefined;
			},
			async onFinish({ responseMessage }) {
				// Save complete UIMessage to Durable Object (AI SDK v5 best practice)
				const hasText =
					extractMessageText(responseMessage)
						.slice(0, MAX_MESSAGE_LENGTH)
						.trim().length > 0;

				if (hasText) {
					// Store complete UIMessage with all parts (text, reasoning, tools, etc.)
					await stub.appendMessages(conversationId, [
						{
							...responseMessage,
							id:
								responseMessage.id ||
								resolveMessageId(responseMessage.id, "assistant"),
							created:
								(responseMessage as { created?: number }).created || Date.now(),
						} as StoredUIMessage,
					]);
				}

				// Generate conversation title if needed
				const google = createGoogleGenerativeAI({
					apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
				});
				await maybeGenerateConversationTitle({
					stub,
					google,
					conversationId,
					uiMessages,
					responseMessage,
				});

				// Close MCP clients
				await closeMCPClients(clients);

				// Track usage for analytics/billing
				// AI SDK v5 provides usage in metadata or on the message object
				const usageData =
					responseMessage.metadata?.usage ||
					(responseMessage as unknown as { usage?: LanguageModelUsage }).usage;

				if (usageData) {
					await recordUsage(userId, {
						modelId,
						usage: usageData,
						conversationId,
					});
				}
			},
		});
	} catch (err) {
		if (err instanceof QuotaExceededError) {
			const limitInfo =
				err.limitType === "daily"
					? "You've reached your daily message limit. Try again tomorrow or upgrade your plan."
					: "You've reached your monthly message limit. Your usage will reset on the 1st of next month.";
			return c.json(
				{
					error: limitInfo,
					limitType: err.limitType,
				},
				429,
			);
		}
		if (err instanceof UnauthorizedError) {
			return c.json({ error: "Authentication required" }, 401);
		}
		throw err;
	}
});
