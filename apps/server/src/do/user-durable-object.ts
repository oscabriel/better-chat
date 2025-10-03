import { DurableObject } from "cloudflare:workers";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import type { StoredUIMessage } from "@/server/lib/do";
// @ts-expect-error - generated JS file has no types
import migrations from "./migrations/migrations.js";
import * as schema from "./schema/chat";

export class UserDurableObject extends DurableObject<Env> {
	private readonly db: ReturnType<typeof drizzle>;
	private readonly userId: string;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		const durableObjectId = ctx.id.toString();
		const maybeName = (ctx.id as { name?: string | null }).name;
		this.userId =
			typeof maybeName === "string" && maybeName.length > 0
				? maybeName
				: durableObjectId;
		this.db = drizzle(ctx.storage, { schema, logger: false });

		ctx.blockConcurrencyWhile(async () => {
			try {
				await migrate(this.db, migrations);
			} catch (error) {
				console.error("user-do migrate failed", {
					userId: this.userId,
					error,
				});
				throw error;
			}
		});
	}

	async runMigrations() {
		await migrate(this.db, migrations);
		return { status: "ok" } as const;
	}

	async listConversations(): Promise<
		Array<{
			id: string;
			title: string | null;
			created: Date;
			updated: Date;
		}>
	> {
		return await this.db
			.select()
			.from(schema.conversations)
			.orderBy(desc(schema.conversations.updated))
			.all();
	}

	async getConversation(conversationId: string) {
		const row = await this.db
			.select()
			.from(schema.conversations)
			.where(eq(schema.conversations.id, conversationId))
			.get();
		return row ?? null;
	}

	async listMessages(conversationId: string, limit = 100, cursor?: number) {
		const cappedLimit = Math.min(limit, 200);
		const condition = cursor
			? and(
					eq(schema.messages.conversationId, conversationId),
					lt(schema.messages.created, new Date(cursor)),
				)
			: eq(schema.messages.conversationId, conversationId);

		const rows = await this.db
			.select()
			.from(schema.messages)
			.where(condition)
			.orderBy(asc(schema.messages.created))
			.limit(cappedLimit);

		const nextCursor =
			rows.length === cappedLimit
				? rows[rows.length - 1]?.created instanceof Date
					? rows[rows.length - 1]?.created.getTime()
					: Number(rows[rows.length - 1]?.created) || null
				: null;

		return {
			items: rows.map((row) => {
				try {
					return JSON.parse(row.message) as StoredUIMessage;
				} catch (error) {
					console.error("Failed to parse message JSON:", error);
					return {
						id: row.id,
						role: row.role as "user" | "assistant" | "system",
						parts: [],
						created:
							row.created instanceof Date
								? row.created.getTime()
								: Number(row.created) || 0,
					} as StoredUIMessage;
				}
			}),
			nextCursor,
		};
	}

	async upsertConversation(conversationId: string, title?: string | null) {
		const now = new Date();
		await this.db
			.insert(schema.conversations)
			.values({ id: conversationId, title, created: now, updated: now })
			.onConflictDoUpdate({
				target: schema.conversations.id,
				set: { title, updated: now },
			});
		return { id: conversationId, title: title ?? null };
	}

	async appendMessages(conversationId: string, items: StoredUIMessage[]) {
		if (!items.length) {
			return { count: 0 };
		}

		const maxBatchSize = 100;
		if (items.length > maxBatchSize) {
			throw new Error(`message batch too large (>${maxBatchSize})`);
		}

		await this.upsertConversation(conversationId);

		const values = items.map((uiMessage) => ({
			id: uiMessage.id,
			conversationId,
			role: uiMessage.role,
			message: JSON.stringify(uiMessage),
			created:
				typeof uiMessage.created === "number"
					? new Date(uiMessage.created)
					: new Date(),
		}));
		await this.db
			.insert(schema.messages)
			.values(values)
			.onConflictDoNothing({ target: schema.messages.id });

		const latestCreated = values.reduce(
			(max, row) => (row.created > max ? row.created : max),
			values[0]?.created,
		);
		await this.db
			.update(schema.conversations)
			.set({ updated: latestCreated })
			.where(eq(schema.conversations.id, conversationId));
		return { count: values.length };
	}

	async deleteConversation(conversationId: string) {
		await this.db
			.delete(schema.messages)
			.where(eq(schema.messages.conversationId, conversationId));
		await this.db
			.delete(schema.conversations)
			.where(eq(schema.conversations.id, conversationId));
		return { id: conversationId };
	}
}
