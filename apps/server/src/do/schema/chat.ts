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
		role: text("role").notNull(),
		content: text("content").notNull(),
		created: integer("created", { mode: "timestamp_ms" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(t) => [index("idx_messages_conversation").on(t.conversationId)],
);
