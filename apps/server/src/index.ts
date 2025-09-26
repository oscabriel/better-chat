import { env } from "cloudflare:workers";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { trpcServer } from "@hono/trpc-server";
import { convertToModelMessages, generateText, streamText } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { nanoid } from "nanoid";
import { auth } from "./lib/auth";
import { createContext } from "./lib/context";
import { requireUserDO, UnauthorizedError } from "./lib/guard";
import { appRouter } from "./routers/index";
import { chatRoutes } from "./routes/chat";

export { UserDurableObject } from "./do/user-durable-object";

const MAX_MESSAGE_LENGTH = 32_000;
const MAX_PROMPT_MESSAGES = 200;

type UiMessageLike = {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	parts: Array<{ type: "text"; text: string }>;
	metadata?: unknown;
};

function extractMessageText(message: unknown): string {
	if (!message || typeof message === "number") {
		return "";
	}
	if (typeof message === "string") {
		return message;
	}
	if (typeof message === "object") {
		const candidate = message as {
			content?: unknown;
			parts?: unknown;
			text?: unknown;
		};
		if (typeof candidate.text === "string") {
			return candidate.text;
		}
		if (typeof candidate.content === "string") {
			return candidate.content;
		}
		if (Array.isArray(candidate.content)) {
			const text = candidate.content
				.map((part) => {
					if (typeof part === "string") return part;
					if (
						part &&
						typeof part === "object" &&
						"text" in part &&
						typeof (part as { text?: unknown }).text === "string"
					) {
						return (part as { text: string }).text;
					}
					return "";
				})
				.filter((segment) => segment.trim().length > 0)
				.join("\n");
			return text;
		}
		if (Array.isArray(candidate.parts)) {
			const text = candidate.parts
				.map((part) => {
					if (typeof part === "string") return part;
					if (
						part &&
						typeof part === "object" &&
						"text" in part &&
						typeof (part as { text?: unknown }).text === "string"
					) {
						return (part as { text: string }).text;
					}
					return "";
				})
				.filter((segment) => segment.trim().length > 0)
				.join("\n");
			return text;
		}
	}
	return "";
}

function resolveMessageId(candidate: unknown, fallbackPrefix: string): string {
	if (typeof candidate === "string" && candidate.trim().length > 0) {
		return candidate.trim();
	}
	return `${fallbackPrefix}-${nanoid()}`;
}

function normalizeToUiMessage(message: unknown): UiMessageLike | null {
	const text = extractMessageText(message);
	if (text.trim().length === 0) {
		return null;
	}
	const candidate = message as { id?: unknown; role?: unknown };
	const role =
		typeof candidate.role === "string" &&
		["user", "assistant", "system"].includes(candidate.role)
			? (candidate.role as UiMessageLike["role"])
			: "user";
	const id =
		typeof candidate.id === "string" && candidate.id.trim().length > 0
			? candidate.id.trim()
			: `${role}-${nanoid()}`;
	return {
		id,
		role,
		content: text,
		parts: [
			{
				type: "text",
				text,
			},
		],
	};
}

function mapStoredHistoryToUi(
	items: Array<{ id: string; role: string; content: string; created: Date }>,
): UiMessageLike[] {
	return items
		.slice()
		.sort((a, b) => a.created.getTime() - b.created.getTime())
		.map((item) =>
			normalizeToUiMessage({
				id: item.id,
				role: item.role,
				content: item.content,
			}),
		)
		.filter((value): value is UiMessageLike => value !== null);
}

function mergeHistoryWithIncoming(
	stored: UiMessageLike[],
	incoming: unknown[],
): UiMessageLike[] {
	const merged: UiMessageLike[] = [];
	const seenIds = new Set<string>();

	for (const message of stored) {
		if (seenIds.has(message.id)) {
			continue;
		}
		seenIds.add(message.id);
		merged.push(message);
	}

	for (const raw of incoming) {
		const normalized = normalizeToUiMessage(raw);
		if (!normalized) continue;
		if (seenIds.has(normalized.id)) {
			continue;
		}
		seenIds.add(normalized.id);
		merged.push(normalized);
	}

	return merged.slice(-MAX_PROMPT_MESSAGES);
}

const TITLE_MODEL_NAME = "gemini-2.0-flash";
const TITLE_MAX_LENGTH = 80;
const TITLE_MAX_WORDS = 6;

function sanitizeTitle(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const cleaned = raw.replace(/["'`]/g, "").replace(/\s+/g, " ").trim();
	if (!cleaned) return null;
	const truncated = cleaned.slice(0, TITLE_MAX_LENGTH);
	const withoutTrailing = truncated.replace(/[\s.!?;:,-]+$/g, "").trim();
	if (!withoutTrailing) return null;
	const words = withoutTrailing.split(/\s+/).slice(0, TITLE_MAX_WORDS);
	if (words.length === 0) return null;
	const result = words.join(" ");
	return result;
}

import type { UserDOStub } from "./lib/do";

async function maybeGenerateConversationTitle(options: {
	stub: UserDOStub;
	google: ReturnType<typeof createGoogleGenerativeAI>;
	conversationId: string;
	uiMessages: unknown[];
	responseMessage: unknown;
}) {
	const { stub, google, conversationId, uiMessages, responseMessage } = options;
	try {
		const existing = await stub.getConversation(conversationId);
		if (existing?.title) {
			return;
		}
		const stored = await stub.listMessages(conversationId, 50);
		const chronological = stored.items
			.slice()
			.sort(
				(a: { created: Date }, b: { created: Date }) =>
					a.created.getTime() - b.created.getTime(),
			);
		const relevantStored = chronological
			.filter((item: { role: string }) => item.role !== "system")
			.map((item: { role: string; content: string | null | undefined }) => ({
				role: item.role,
				content: (item.content ?? "").toString().trim(),
			}))
			.filter((item: { content: string }) => item.content.length > 0)
			.slice(0, 5);
		let relevantMessages = relevantStored as Array<{
			role: string;
			content: string;
		}>;
		if (relevantMessages.length === 0) {
			relevantMessages = (
				[...uiMessages, responseMessage] as Array<{
					role?: string;
					content?: unknown;
					parts?: unknown;
				}>
			)
				.filter((message) => message && message.role !== "system")
				.slice(0, 5)
				.map((message) => {
					const text = extractMessageText(message as unknown)
						?.replace(/\s+/g, " ")
						.trim();
					if (!text) return null;
					return {
						role: (message.role as string) ?? "user",
						content: text,
					};
				})
				.filter((value): value is { role: string; content: string } =>
					Boolean(value),
				);
		}
		if (relevantMessages.length === 0) {
			return;
		}
		const formatted = relevantMessages
			.map(
				(message: { role: string; content: string }) =>
					`${message.role ?? "user"}: ${message.content}`,
			)
			.join("\n");
		const { text } = await generateText({
			model: google(TITLE_MODEL_NAME),
			maxOutputTokens: 64,
			messages: [
				{
					role: "system",
					content: `
You are tasked with generating a concise, descriptive title for a chat conversation based on the initial messages. The title should:

1. Be 2-6 words long
2. Capture the main topic or question being discussed
3. Be clear and specific
4. Use title case (capitalize first letter of each major word)
5. Not include quotation marks or special characters
6. Be professional and appropriate

Examples of good titles:
- "Python Data Analysis Help"
- "React Component Design"
- "Travel Planning Italy"
- "Budget Spreadsheet Formula"
- "Career Change Advice"

Generate a title that accurately represents what this conversation is about based on the messages provided. Respond with the title only.`,
				},
				{
					role: "user",
					content: `Here are the first ${relevantMessages.length} messages of the conversation:\n\n${formatted}\n\nGenerate a title that accurately represents what this conversation is about based on the messages provided.`,
				},
			],
		});
		const title = sanitizeTitle(text);
		if (title) {
			await stub.upsertConversation(conversationId, title);
		}
	} catch (error) {
		console.error("conversation title generation failed", {
			conversationId,
			error,
		});
	}
}

const app = new Hono().basePath("/api");

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN || "http://localhost:3001",
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "User-Agent"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));

app.use(
	"/trpc/*",
	trpcServer({
		endpoint: "/api/trpc",
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);

app.route("/chat", chatRoutes);

app.post("/ai", async (c) => {
	try {
		const { stub } = await requireUserDO(c);

		const body = await c.req.json();
		const uiMessages = body.messages || [];
		const conversationId: string = body.conversationId || nanoid();

		// persist the last user message before generation
		const last = uiMessages[uiMessages.length - 1];
		if (last?.role === "user") {
			const text = extractMessageText(last).slice(0, MAX_MESSAGE_LENGTH);
			if (text.trim().length > 0) {
				await stub.appendMessages(conversationId, [
					{
						id: resolveMessageId(last.id, "user"),
						role: "user",
						content: text,
						created: Date.now(),
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
		const mergedForModel: Parameters<typeof convertToModelMessages>[0] =
			mergedUiMessages.map((m) => ({
				role: m.role,
				parts: m.parts,
				metadata: m.metadata,
			}));
		const result = streamText({
			model: google("gemini-2.0-flash"),
			messages: convertToModelMessages(mergedForModel),
		});

		// Persist assistant output on finish; reuse original IDs to avoid duplicates
		return result.toUIMessageStreamResponse({
			originalMessages: uiMessages,
			generateMessageId: () => nanoid(),
			async onFinish({ responseMessage }) {
				const text = extractMessageText(responseMessage).slice(
					0,
					MAX_MESSAGE_LENGTH,
				);
				if (text.trim().length > 0) {
					await stub.appendMessages(conversationId, [
						{
							id: resolveMessageId(responseMessage.id, "assistant"),
							role: "assistant",
							content: text,
							created: Date.now(),
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

app.get("/", (c) => {
	return c.text("OK");
});

export default app;
