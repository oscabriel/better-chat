/**
 * Shared chat-related types used across the application
 */

export type ApiErrorPayload = { error?: string; message?: string };

export type ConversationSummary = {
	id: string;
	title: string | null;
	created: string;
	updated: string;
};

export type ConversationListResponse = {
	items: ConversationSummary[];
};

export type StoredMessage = {
	id: string;
	role: string;
	content: string;
	created: number | string;
};

export type MessageListResponse = {
	items: StoredMessage[];
	nextCursor: number | null;
};

export type TextPart = {
	type: "text";
	text: string;
};

export type EnrichedMessage = {
	id: string;
	role: "user" | "assistant" | "system";
	parts: Array<TextPart>;
	created: number;
};

export type MaybeEnrichedMessage = {
	id: string;
	role: string;
	parts?: Array<{ type: string; text?: string }>;
	created?: number;
};

export type QuickPrompt = {
	id: string;
	label: string;
	text: string;
};
