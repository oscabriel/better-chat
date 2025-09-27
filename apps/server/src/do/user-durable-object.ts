import { DurableObject } from "cloudflare:workers";
import { and, desc, eq, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import type { MessageInput } from "@/server/lib/do";
// @ts-expect-error - generated JS file has no types
import migrations from "./migrations/migrations.js";
import * as schema from "./schema/chat";

function parseJsonArray(value: unknown): unknown[] {
	if (Array.isArray(value)) {
		return value;
	}
	if (typeof value === "string" && value.length > 0) {
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : [];
		} catch (error) {
			console.error("failed to parse json array", { value, error });
			return [];
		}
	}
	if (value == null) {
		return [];
	}
	return [];
}

function parseJson<T>(value: unknown): T | null {
	if (value == null) {
		return null;
	}
	if (typeof value === "string" && value.length > 0) {
		try {
			return JSON.parse(value) as T;
		} catch (error) {
			console.error("failed to parse json value", { value, error });
			return null;
		}
	}
	return value as T;
}

export class UserDurableObject extends DurableObject {
	private db: ReturnType<typeof drizzle>;
	private userId: string;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.userId = ctx.id.toString();
		this.db = drizzle(ctx.storage, { schema, logger: false });

		// Ensure schema is ready before serving traffic
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

	// Optional: explicit migration trigger for operational endpoints
	async runMigrations() {
		await migrate(this.db, migrations);
		return { status: "ok" } as const;
	}

	// RPC methods (preferred over HTTP subrequests)
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
			.orderBy(desc(schema.messages.created))
			.limit(cappedLimit);

		const nextCursor =
			rows.length === cappedLimit
				? rows[rows.length - 1]?.created instanceof Date
					? rows[rows.length - 1]?.created.getTime()
					: Number(rows[rows.length - 1]?.created) || null
				: null;

		return {
			items: rows.map((row) => ({
				id: row.id,
				conversationId: row.conversationId,
				role: row.role,
				parts: parseJsonArray(row.parts),
				reasoning: parseJsonArray(row.reasoning),
				toolCalls: parseJsonArray(row.toolCalls),
				toolResults: parseJsonArray(row.toolResults),
				error: parseJson(row.error),
				created:
					row.created instanceof Date
						? row.created.getTime()
						: Number(row.created) || 0,
			})),
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

	async appendMessages(conversationId: string, items: MessageInput[]) {
		if (!items.length) {
			return { count: 0 };
		}

		const maxBatchSize = 100;
		if (items.length > maxBatchSize) {
			throw new Error(`message batch too large (>${maxBatchSize})`);
		}

		await this.upsertConversation(conversationId);

		const values = items.map((m) => ({
			id: m.id,
			conversationId,
			role: m.role,
			parts: JSON.stringify(m.parts ?? []),
			reasoning: JSON.stringify(m.reasoning ?? []),
			toolCalls: JSON.stringify(m.toolCalls ?? []),
			toolResults: JSON.stringify(m.toolResults ?? []),
			error: m.error === undefined ? null : JSON.stringify(m.error),
			created: m.created ? new Date(m.created) : new Date(),
		}));
		await this.db
			.insert(schema.messages)
			.values(values)
			.onConflictDoNothing({ target: schema.messages.id });
		// touch conversation updated
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
