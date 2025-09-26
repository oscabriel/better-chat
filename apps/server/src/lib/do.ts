export type ConversationRecord = {
	id: string;
	title: string | null;
	created: Date;
	updated: Date;
};

export type MessageRecord = {
	id: string;
	conversationId: string;
	role: string;
	content: string;
	created: Date;
};

export type MessageInput = {
	id: string;
	role: string;
	content: string;
	created?: number;
};

export type UserDOStub = {
	listConversations(): Promise<ConversationRecord[]>;
	getConversation(conversationId: string): Promise<ConversationRecord | null>;
	listMessages(
		conversationId: string,
		limit?: number,
		cursor?: number,
	): Promise<{ items: MessageRecord[]; nextCursor: number | null }>;
	upsertConversation(
		conversationId: string,
		title?: string | null,
	): Promise<{ id: string; title: string | null }>;
	appendMessages(
		conversationId: string,
		items: MessageInput[],
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
