import type { UIMessage } from "ai";

/**
 * Extended UIMessage with required created timestamp for storage
 */
export type StoredUIMessage = UIMessage & {
	created: number;
};

export type ConversationRecord = {
	id: string;
	title: string | null;
	created: Date;
	updated: Date;
};

export type UserSettings = {
	selectedModel: string;
	apiKeys: Record<string, string>;
	enabledModels: string[];
	enabledMcpServers: string[];
	theme: string;
};

export type CustomMCPServer = {
	id: string;
	userId?: string;
	name: string;
	url: string;
	type: "http" | "sse";
	description?: string;
	headers?: Record<string, string>;
	enabled: boolean;
	created: Date;
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
	getUserSettings(): Promise<UserSettings>;
	updateUserSettings(updates: Partial<UserSettings>): Promise<void>;
	getCustomMCPServers(): Promise<CustomMCPServer[]>;
	addCustomMCPServer(server: {
		id: string;
		userId?: string;
		name: string;
		url: string;
		type: "http" | "sse";
		description?: string;
		headers?: Record<string, string>;
		enabled: boolean;
		created: Date;
	}): Promise<void>;
	removeCustomMCPServer(serverId: string): Promise<void>;
	toggleCustomMCPServer(serverId: string, enabled: boolean): Promise<void>;
};

export function getUserDOStub(env: unknown, userId: string): UserDOStub {
	const envTyped = env as {
		USER_DO: { idFromName(name: string): unknown; get(id: unknown): unknown };
	};
	const id = envTyped.USER_DO.idFromName(userId);
	return envTyped.USER_DO.get(id) as UserDOStub;
}
