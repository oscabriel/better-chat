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

export type MessagePart = {
	type: string;
	text?: string;
	state?: string;
	[key: string]: unknown;
};

export type StoredMessage = {
	id: string;
	role: string;
	parts: MessagePart[];
	reasoning: MessagePart[];
	toolCalls: MessagePart[];
	toolResults: MessagePart[];
	error: MessagePart[] | null;
	created: number | string;
};

export type MessageListResponse = {
	items: StoredMessage[];
	nextCursor: number | null;
};

export type EnrichedMessage = {
	id: string;
	role: "user" | "assistant" | "system";
	parts: MessagePart[];
	created: number;
};

export type MaybeEnrichedMessage = {
	id: string;
	role: string;
	parts?: MessagePart[];
	created?: number;
};

export type QuickPrompt = {
	id: string;
	label: string;
	text: string;
};
