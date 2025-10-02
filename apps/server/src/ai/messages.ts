import { nanoid } from "nanoid";

export const MAX_MESSAGE_LENGTH = 32_000;
export const MAX_PROMPT_MESSAGES = 200;

export type UiMessagePart = {
	type: string;
	text?: string;
	[key: string]: unknown;
};

export type UiMessageLike = {
	id: string;
	role: "user" | "assistant" | "system";
	parts: UiMessagePart[];
	created: number;
	metadata?: unknown;
};

function sanitizeText(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.slice(0, MAX_MESSAGE_LENGTH);
	return trimmed.length > 0 ? trimmed : null;
}

function sanitizeParts(candidateParts: unknown): UiMessagePart[] {
	if (!Array.isArray(candidateParts)) {
		return [];
	}

	const result: UiMessagePart[] = [];

	for (const raw of candidateParts) {
		if (!raw || typeof raw !== "object") {
			continue;
		}
		const { type } = raw as { type?: unknown };
		if (typeof type !== "string" || type.trim().length === 0) {
			continue;
		}
		const normalized: UiMessagePart = { type };
		for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
			if (key === "type") continue;
			if (key === "text") {
				const safeText = sanitizeText(value);
				if (safeText !== null) {
					normalized.text = safeText;
				}
				continue;
			}
			normalized[key] = value;
		}

		if (normalized.type === "text" && !("text" in normalized)) {
			continue;
		}

		result.push(normalized);
	}

	return result;
}

export function extractMessageText(message: unknown): string {
	if (!message || typeof message !== "object") {
		return "";
	}

	const candidate = message as {
		parts?: unknown;
		text?: unknown;
		content?: unknown;
	};
	const parts = sanitizeParts(candidate.parts ?? candidate.content);
	if (parts.length > 0) {
		return parts
			.filter((part) => part.type === "text" && typeof part.text === "string")
			.map((part) => part.text?.trim())
			.filter((value) => value && value.length > 0)
			.join("\n");
	}

	const fallback =
		sanitizeText(candidate.text) ||
		(sanitizeText(
			typeof candidate.content === "string" ? candidate.content : null,
		) ??
			"");

	return fallback ?? "";
}

export function resolveMessageId(
	candidate: unknown,
	fallbackPrefix: string,
): string {
	if (typeof candidate === "string" && candidate.trim().length > 0) {
		return candidate.trim();
	}
	return `${fallbackPrefix}-${nanoid()}`;
}

function coerceRole(value: unknown): UiMessageLike["role"] {
	if (value === "assistant" || value === "system") {
		return value;
	}
	return "user";
}

export function normalizeToUiMessage(message: unknown): UiMessageLike | null {
	if (!message || typeof message !== "object") {
		return null;
	}

	const candidate = message as {
		id?: unknown;
		role?: unknown;
		parts?: unknown;
		content?: unknown;
		text?: unknown;
		created?: unknown;
		metadata?: unknown;
		reasoning?: unknown;
		toolCalls?: unknown;
		toolResults?: unknown;
		error?: unknown;
	};

	let parts = sanitizeParts(candidate.parts ?? candidate.content);

	if (parts.length === 0 && typeof candidate.text === "string") {
		const safeText = sanitizeText(candidate.text);
		if (safeText) {
			parts = [{ type: "text", text: safeText }];
		}
	}

	if (parts.length === 0) {
		return null;
	}

	const role = coerceRole(candidate.role);
	const id = resolveMessageId(candidate.id, role);
	const created =
		typeof candidate.created === "number" ? candidate.created : Date.now();

	return {
		id,
		role,
		parts,
		created,
		metadata: candidate.metadata,
	};
}

export function mapStoredHistoryToUi(
	items: Array<{
		id: string;
		role: string;
		parts: unknown[];
		created: number;
	}>,
): UiMessageLike[] {
	return items
		.slice()
		.sort((a, b) => a.created - b.created)
		.map((item) =>
			normalizeToUiMessage({
				id: item.id,
				role: item.role,
				parts: item.parts,
				created: item.created,
			}),
		)
		.filter((value): value is UiMessageLike => value !== null);
}

export function mergeHistoryWithIncoming(
	stored: UiMessageLike[],
	incoming: unknown[],
): UiMessageLike[] {
	const merged: UiMessageLike[] = [];
	const seenIds = new Set<string>();
	const seenHashes = new Set<string>();

	for (const message of stored) {
		if (seenIds.has(message.id)) {
			continue;
		}
		seenIds.add(message.id);
		seenHashes.add(createContentKey(message));
		merged.push(message);
	}

	for (const raw of incoming) {
		const normalized = normalizeToUiMessage(raw);
		if (!normalized) continue;
		if (seenIds.has(normalized.id)) {
			continue;
		}
		const contentKey = createContentKey(normalized);
		if (contentKey && seenHashes.has(contentKey)) {
			continue;
		}
		seenIds.add(normalized.id);
		if (contentKey) {
			seenHashes.add(contentKey);
		}
		merged.push(normalized);
	}

	return merged.slice(-MAX_PROMPT_MESSAGES);
}

function createContentKey(message: UiMessageLike): string {
	const parts = message.parts
		.filter((part) => part.type === "text" && typeof part.text === "string")
		.map((part) => part.text?.trim())
		.filter((text) => text && text.length > 0);
	return `${message.role}:${parts.join("\n")}`;
}

export function extractStructuredAnnotations(message: UiMessageLike) {
	const reasoning = message.parts.filter((part) => part.type === "reasoning");
	const toolParts = message.parts.filter(
		(part) =>
			typeof part.type === "string" &&
			(part.type.startsWith("tool-") || part.type === "dynamic-tool"),
	);
	const toolCalls = toolParts.filter((part) => {
		const state = part.state as string | undefined;
		return state === "input-streaming" || state === "input-available";
	});
	const toolResults = toolParts.filter((part) => {
		const state = part.state as string | undefined;
		return state === "output-available";
	});
	const toolErrors = toolParts.filter((part) => {
		const state = part.state as string | undefined;
		return state === "output-error";
	});

	return {
		reasoning,
		toolCalls,
		toolResults,
		errors: toolErrors,
	};
}
