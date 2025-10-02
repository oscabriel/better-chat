import type { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

import type { StoredUIMessage, UserDOStub } from "@/server/lib/do";

import { extractMessageText } from "./messages";

const TITLE_MODEL_NAME = "gemini-2.5-flash-lite";
const TITLE_MAX_LENGTH = 80;
const TITLE_MAX_WORDS = 6;

export function sanitizeTitle(raw: string | null | undefined): string | null {
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

export async function maybeGenerateConversationTitle(options: {
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
		const chronological: StoredUIMessage[] = stored.items
			.slice()
			.sort((a, b) => a.created - b.created);
		const relevantStored = chronological
			.filter((item) => item.role !== "system")
			.map((item) => {
				const text = extractMessageText({ parts: item.parts })
					.replace(/\s+/g, " ")
					.trim();
				return {
					role: item.role,
					content: text,
				};
			})
			.filter((item) => item.content.length > 0)
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
