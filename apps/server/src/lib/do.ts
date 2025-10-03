import type { UIMessage } from "ai";

export type StoredUIMessage = UIMessage & {
	created: number;
};

export type ConversationRecord = {
	id: string;
	title: string | null;
	created: Date;
	updated: Date;
};

export type UserDOStub = {
	listConversations(): Promise<ConversationRecord[]>;
	getConversation(conversationId: string): Promise<ConversationRecord | null>;
	listMessages(
		conversationId: string,
		limit?: number,
		cursor?: number,
	): Promise<{ items: StoredUIMessage[]; nextCursor: number | null }>;
	upsertConversation(
		conversationId: string,
		title?: string | null,
	): Promise<{ id: string; title: string | null }>;
	appendMessages(
		conversationId: string,
		items: StoredUIMessage[],
	): Promise<{ count: number }>;
	deleteConversation(conversationId: string): Promise<{ id: string }>;
};

export function getUserDOStub(env: unknown, userId: string): UserDOStub {
	const envTyped = env as {
		USER_DO: { idFromName(name: string): unknown; get(id: unknown): unknown };
	};
	const id = envTyped.USER_DO.idFromName(userId);
	return envTyped.USER_DO.get(id) as UserDOStub;
}
