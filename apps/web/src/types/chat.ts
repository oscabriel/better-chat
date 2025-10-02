import type { UIMessage } from "ai";

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

/**
 * MessageListResponse now returns UIMessage[] directly (AI SDK v5 format)
 */
export type MessageListResponse = {
	items: UIMessage[];
	nextCursor: number | null;
};

export type QuickPrompt = {
	id: string;
	label: string;
	text: string;
};
