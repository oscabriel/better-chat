import { nanoid } from "nanoid";
import type {
	ApiErrorPayload,
	EnrichedMessage,
	MaybeEnrichedMessage,
	MessagePart,
	StoredMessage,
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

function sanitizeParts(parts: unknown): MessagePart[] {
	if (!Array.isArray(parts)) {
		return [];
	}
	return parts
		.map((part) => {
			if (!part || typeof part !== "object") {
				return null;
			}
			const candidate = part as { type?: unknown; text?: unknown; state?: unknown } & Record<string, unknown>;
			if (typeof candidate.type !== "string" || candidate.type.trim().length === 0) {
				return null;
			}
			const normalized: MessagePart = { type: candidate.type };
			if (typeof candidate.text === "string") {
				normalized.text = candidate.text;
			}
			if (typeof candidate.state === "string") {
				normalized.state = candidate.state;
			}
			for (const [key, value] of Object.entries(candidate)) {
				if (key === "type" || key === "text" || key === "state") {
					continue;
				}
				normalized[key] = value;
			}
			return normalized;
		})
		.filter((part): part is MessagePart => part !== null);
}

export function mapStoredMessages(items: StoredMessage[]): EnrichedMessage[] {
	return items
		.slice()
		.reverse()
		.map((message) => ({
			id: message.id,
			role: message.role as "user" | "assistant" | "system",
			parts: sanitizeParts(message.parts),
			created:
				typeof message.created === "number"
					? message.created
					: Number(message.created) || 0,
		}));
}

export function isTextPart(part: unknown): part is MessagePart & { type: "text"; text: string } {
	return (
		typeof part === "object" &&
		part !== null &&
		"type" in part &&
		(part as { type?: unknown }).type === "text" &&
		"text" in part &&
		typeof (part as { text?: unknown }).text === "string"
	);
}

export function stringifyParts(parts: MessagePart[] | undefined): string {
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
			? sanitizeParts(message.parts)
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
