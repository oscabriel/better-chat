import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const conversations = sqliteTable("conversations", {
	id: text("id").primaryKey(),
	title: text("title"),
	created: integer("created", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
	updated: integer("updated", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date())
		.notNull(),
});

export const messages = sqliteTable(
	"messages",
	{
		id: text("id").primaryKey(),
		conversationId: text("conversation_id").notNull(),
		// Store complete UIMessage as JSON (AI SDK v5 best practice)
		message: text("message").notNull(),
		// Keep role for efficient queries
		role: text("role").notNull(),
		created: integer("created", { mode: "timestamp_ms" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(t) => [
		index("idx_messages_conversation_created").on(t.conversationId, t.created),
	],
);

export const userSettings = sqliteTable("user_settings", {
	userId: text("user_id").primaryKey(),
	selectedModel: text("selected_model").default("google:gemini-2.5-flash-lite"),
	apiKeys: text("api_keys").default("{}"), // JSON object of provider API keys for BYOK
	enabledModels: text("enabled_models").default("[]"), // JSON array of model IDs to show in selector
	enabledMcpServers: text("enabled_mcp_servers").default(
		'["context7","cloudflare-docs"]',
	), // JSON array of built-in server IDs
	theme: text("theme").default("system"),
	updated: integer("updated", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date())
		.notNull(),
});

export const userMcpServers = sqliteTable("user_mcp_servers", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	name: text("name").notNull(),
	url: text("url").notNull(),
	type: text("type").notNull(), // 'http' | 'sse'
	description: text("description"),
	headers: text("headers").default("{}"), // JSON object of headers for authentication
	enabled: integer("enabled", { mode: "boolean" }).default(true),
	created: integer("created", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
});
