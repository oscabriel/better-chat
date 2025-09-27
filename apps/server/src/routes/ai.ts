import { env } from "cloudflare:workers";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { convertToModelMessages, streamText } from "ai";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import {
	extractMessageText,
	MAX_MESSAGE_LENGTH,
	MAX_PROMPT_MESSAGES,
	mapStoredHistoryToUi,
	mergeHistoryWithIncoming,
	normalizeToUiMessage,
	resolveMessageId,
	extractStructuredAnnotations,
} from "@/server/ai/messages";
import { maybeGenerateConversationTitle } from "@/server/ai/title-generation";
import { requireUserDO, UnauthorizedError } from "@/server/lib/guard";

export const aiRoutes = new Hono();

aiRoutes.post("/", async (c) => {
	try {
		const { stub } = await requireUserDO(c);

		const body = await c.req.json();
		const uiMessages = body.messages || [];
		const conversationId: string = body.conversationId || nanoid();

		// Persist the last user message before generation.
		const last = uiMessages[uiMessages.length - 1];
		if (last?.role === "user") {
			const normalized = normalizeToUiMessage({
				...last,
				id: resolveMessageId(last.id, "user"),
			});
			if (normalized) {
				const annotations = extractStructuredAnnotations(normalized);
				await stub.appendMessages(conversationId, [
					{
						id: normalized.id,
						role: normalized.role,
						parts: normalized.parts,
						reasoning: annotations.reasoning,
						toolCalls: annotations.toolCalls,
						toolResults: annotations.toolResults,
						error:
							annotations.errors.length > 0
								? annotations.errors
								: null,
						created: normalized.created,
					},
				]);
			}
		}

		const google = createGoogleGenerativeAI({
			apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
		});
		const history = await stub.listMessages(
			conversationId,
			MAX_PROMPT_MESSAGES,
		);
		const storedUiMessages = mapStoredHistoryToUi(history.items);
		const mergedUiMessages = mergeHistoryWithIncoming(
			storedUiMessages,
			uiMessages,
		);
		const mergedForModel = mergedUiMessages.map((m) => ({
			role: m.role,
			parts: m.parts as Parameters<typeof convertToModelMessages>[0][number]["parts"],
			metadata: m.metadata,
		})) as Parameters<typeof convertToModelMessages>[0];
		const result = streamText({
			model: google("gemini-2.0-flash"),
			messages: convertToModelMessages(mergedForModel),
		});

		return result.toUIMessageStreamResponse({
			originalMessages: uiMessages,
			generateMessageId: () => nanoid(),
			async onFinish({ responseMessage }) {
				const normalized = normalizeToUiMessage({
					...responseMessage,
					id: resolveMessageId(responseMessage.id, "assistant"),
				});
				const hasText = extractMessageText(responseMessage).slice(0, MAX_MESSAGE_LENGTH).trim().length > 0;
				if (normalized && hasText) {
					const annotations = extractStructuredAnnotations(normalized);
					await stub.appendMessages(conversationId, [
						{
							id: normalized.id,
							role: normalized.role,
							parts: normalized.parts,
							reasoning: annotations.reasoning,
							toolCalls: annotations.toolCalls,
							toolResults: annotations.toolResults,
							error:
								annotations.errors.length > 0
									? annotations.errors
									: null,
							created: normalized.created,
						},
					]);
				}
				await maybeGenerateConversationTitle({
					stub,
					google,
					conversationId,
					uiMessages,
					responseMessage,
				});
			},
		});
	} catch (err) {
		if (err instanceof UnauthorizedError)
			return c.json({ error: "Authentication required" }, 401);
		throw err;
	}
});
