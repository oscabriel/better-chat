import { nanoid } from "nanoid";
import type {
	ApiErrorPayload,
	EnrichedMessage,
	MaybeEnrichedMessage,
	StoredMessage,
	TextPart,
} from "../types/chat";

/**
 * Chat-related utility functions
 */

export function generateConversationId(): string {
	return nanoid();
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
	let parsed: unknown = null;
	try {
		parsed = await response.json();
	} catch (_error) {
		parsed = null;
	}

	if (!response.ok) {
		let message = response.statusText || "Request failed";
		if (parsed && typeof parsed === "object") {
			const { error, message: bodyMessage } = parsed as ApiErrorPayload;
			if (typeof error === "string" && error.trim().length > 0) {
				message = error;
			} else if (
				typeof bodyMessage === "string" &&
				bodyMessage.trim().length > 0
			) {
				message = bodyMessage;
			}
		}
		throw new Error(message);
	}

	return parsed as T;
}

export function mapStoredMessages(items: StoredMessage[]): EnrichedMessage[] {
	return items
		.slice()
		.reverse()
		.map((message) => ({
			id: message.id,
			role: message.role as "user" | "assistant" | "system",
			parts: [
				{
					type: "text" as const,
					text: message.content,
				},
			],
			created:
				typeof message.created === "number"
					? message.created
					: Number(message.created) || 0,
		}));
}

export function isTextPart(part: unknown): part is TextPart {
	return (
		typeof part === "object" &&
		part !== null &&
		"type" in part &&
		(part as { type?: unknown }).type === "text" &&
		"text" in part &&
		typeof (part as { text?: unknown }).text === "string"
	);
}

export function stringifyParts(
	parts: Array<{ type: string; text?: string }> | undefined,
): string {
	if (!parts || parts.length === 0) return "";
	return parts
		.filter(isTextPart)
		.map((part) => part.text.trim())
		.filter((text) => text.length > 0)
		.join("\n");
}

export function createContentKey(
	message: Pick<EnrichedMessage, "role" | "parts">,
): string | null {
	const content = stringifyParts(message.parts);
	if (!content) return null;
	return `${message.role}:${content}`;
}

export function normalizeToEnriched(
	message: EnrichedMessage | MaybeEnrichedMessage,
): EnrichedMessage {
	let messageId = typeof message.id === "string" ? message.id.trim() : "";
	if (!messageId) {
		const fallbackId = `${message.role ?? "assistant"}-${
			"created" in message && typeof message.created === "number"
				? message.created
				: Date.now()
		}`;
		messageId = fallbackId;
		try {
			(message as MaybeEnrichedMessage).id = fallbackId;
		} catch (_error) {
			// ignore if message is readonly
		}
	}
	const parts =
		"parts" in message && Array.isArray(message.parts)
			? (message.parts.filter(isTextPart) as TextPart[])
			: [];
	return {
		id: messageId,
		role: message.role as "user" | "assistant" | "system",
		parts,
		created:
			"created" in message && typeof message.created === "number"
				? message.created
				: Date.now(),
	};
}
