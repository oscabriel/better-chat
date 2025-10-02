import { DurableObject } from "cloudflare:workers";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import {
	decryptApiKeys,
	encryptApiKeys,
	isEncrypted,
} from "@/server/lib/crypto";
import type { StoredUIMessage } from "@/server/lib/do";
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

export class UserDurableObject extends DurableObject<Env> {
	private db: ReturnType<typeof drizzle>;
	private userId: string;
	private userIdFilters: string[];
	protected readonly env: Env;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.env = env;
		const durableObjectId = ctx.id.toString();
		const maybeName = (ctx.id as { name?: string | null }).name;
		const resolvedUserId =
			typeof maybeName === "string" && maybeName.length > 0
				? maybeName
				: durableObjectId;

		this.userId = resolvedUserId;
		this.userIdFilters =
			resolvedUserId === durableObjectId
				? [resolvedUserId]
				: [resolvedUserId, durableObjectId];
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
				// Parse the complete UIMessage from JSON
				try {
					return JSON.parse(row.message) as StoredUIMessage;
				} catch (error) {
					console.error("Failed to parse message JSON:", error);
					// Return a fallback StoredUIMessage
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
			// Store complete UIMessage as JSON (AI SDK v5 best practice)
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

	// User Settings Management
	async getUserSettings(): Promise<{
		selectedModel: string;
		apiKeys: Record<string, string>;
		enabledModels: string[];
		enabledMcpServers: string[];
		theme: string;
	}> {
		const settings = await this.db
			.select()
			.from(schema.userSettings)
			.where(eq(schema.userSettings.userId, this.userId))
			.get();

		if (!settings) {
			// Create default settings
			const defaultSettings = {
				userId: this.userId,
				selectedModel: "google:gemini-2.5-flash-lite",
				apiKeys: "{}",
				enabledModels: "[]",
				enabledMcpServers: '["context7","cloudflare-docs"]',
				theme: "system",
				updated: new Date(),
			};

			await this.db.insert(schema.userSettings).values(defaultSettings);

			return {
				selectedModel: defaultSettings.selectedModel,
				apiKeys: {},
				enabledModels: [],
				enabledMcpServers: JSON.parse(defaultSettings.enabledMcpServers),
				theme: defaultSettings.theme,
			};
		}

		// Parse API keys from storage
		const storedApiKeys = settings.apiKeys ? JSON.parse(settings.apiKeys) : {};

		// Check if keys need migration (unencrypted -> encrypted)
		let decryptedApiKeys: Record<string, string> = {};
		let needsMigration = false;

		const encryptionKey = this.env.API_ENCRYPTION_KEY;
		if (!encryptionKey) {
			console.warn(
				"API_ENCRYPTION_KEY not set - API keys will not be encrypted",
			);
			decryptedApiKeys = storedApiKeys;
		} else {
			// Check if any keys are unencrypted
			for (const [_provider, key] of Object.entries(storedApiKeys)) {
				if (key && !isEncrypted(key as string)) {
					needsMigration = true;
					break;
				}
			}

			if (needsMigration) {
				// Migrate: re-encrypt unencrypted keys
				console.log(`Migrating unencrypted API keys for user ${this.userId}`);
				const migratedKeys: Record<string, string> = {};

				for (const [provider, key] of Object.entries(storedApiKeys)) {
					if (key && !isEncrypted(key as string)) {
						// Key is unencrypted, encrypt it
						migratedKeys[provider] = key as string;
					} else if (key) {
						// Key is already encrypted, keep as-is
						migratedKeys[provider] = key as string;
					}
				}

				// Re-save with encryption
				await this.updateUserSettings({ apiKeys: migratedKeys });

				// Decrypt for return
				decryptedApiKeys = migratedKeys;
			} else {
				// All keys are encrypted, decrypt them
				try {
					decryptedApiKeys = await decryptApiKeys(
						storedApiKeys,
						encryptionKey,
						this.userId,
					);
				} catch (error) {
					console.error("Failed to decrypt API keys:", error);
					decryptedApiKeys = {};
				}
			}
		}

		return {
			selectedModel: settings.selectedModel || "google:gemini-2.5-flash-lite",
			apiKeys: decryptedApiKeys,
			enabledModels: settings.enabledModels
				? JSON.parse(settings.enabledModels)
				: [],
			enabledMcpServers: JSON.parse(
				settings.enabledMcpServers || '["context7","cloudflare-docs"]',
			),
			theme: settings.theme || "system",
		};
	}

	async updateUserSettings(updates: {
		selectedModel?: string;
		apiKeys?: Record<string, string>;
		enabledModels?: string[];
		enabledMcpServers?: string[];
		theme?: string;
	}): Promise<void> {
		const current = await this.getUserSettings();
		const newSettings = { ...current, ...updates };

		// Encrypt API keys before storing
		let encryptedApiKeys = newSettings.apiKeys;
		const encryptionKey = this.env.API_ENCRYPTION_KEY;

		if (encryptionKey && newSettings.apiKeys) {
			try {
				encryptedApiKeys = await encryptApiKeys(
					newSettings.apiKeys,
					encryptionKey,
					this.userId,
				);
			} catch (error) {
				console.error("Failed to encrypt API keys:", error);
				throw new Error("Failed to encrypt API keys");
			}
		} else if (!encryptionKey && newSettings.apiKeys) {
			console.warn(
				"API_ENCRYPTION_KEY not set - storing API keys without encryption",
			);
		}

		await this.db
			.insert(schema.userSettings)
			.values({
				userId: this.userId,
				selectedModel: newSettings.selectedModel,
				apiKeys: JSON.stringify(encryptedApiKeys || {}),
				enabledModels: JSON.stringify(newSettings.enabledModels),
				enabledMcpServers: JSON.stringify(newSettings.enabledMcpServers),
				theme: newSettings.theme,
				updated: new Date(),
			})
			.onConflictDoUpdate({
				target: schema.userSettings.userId,
				set: {
					selectedModel: newSettings.selectedModel,
					apiKeys: JSON.stringify(encryptedApiKeys || {}),
					enabledModels: JSON.stringify(newSettings.enabledModels),
					enabledMcpServers: JSON.stringify(newSettings.enabledMcpServers),
					theme: newSettings.theme,
					updated: new Date(),
				},
			});
	}

	// Custom MCP Server Management
	async getCustomMCPServers(): Promise<
		Array<{
			id: string;
			userId: string;
			name: string;
			url: string;
			type: "http" | "sse";
			description?: string;
			headers?: Record<string, string>;
			enabled: boolean;
			created: Date;
		}>
	> {
		const servers = await this.db
			.select()
			.from(schema.userMcpServers)
			.where(inArray(schema.userMcpServers.userId, this.userIdFilters))
			.all();

		return servers.map((server) => ({
			id: server.id,
			userId: server.userId,
			name: server.name,
			url: server.url,
			type: server.type as "http" | "sse",
			description: server.description || undefined,
			headers: server.headers ? JSON.parse(server.headers) : undefined,
			enabled: Boolean(server.enabled),
			created:
				server.created instanceof Date
					? server.created
					: new Date(server.created),
		}));
	}

	async addCustomMCPServer(server: {
		id: string;
		userId?: string;
		name: string;
		url: string;
		type: "http" | "sse";
		description?: string;
		headers?: Record<string, string>;
		enabled: boolean;
		created: Date;
	}): Promise<void> {
		await this.db.insert(schema.userMcpServers).values({
			id: server.id,
			userId: this.userId,
			name: server.name,
			url: server.url,
			type: server.type,
			description: server.description,
			headers: JSON.stringify(server.headers || {}),
			enabled: server.enabled,
			created: server.created,
		});
	}

	async removeCustomMCPServer(serverId: string): Promise<void> {
		await this.db
			.delete(schema.userMcpServers)
			.where(
				and(
					eq(schema.userMcpServers.id, serverId),
					inArray(schema.userMcpServers.userId, this.userIdFilters),
				),
			);
	}

	async toggleCustomMCPServer(
		serverId: string,
		enabled: boolean,
	): Promise<void> {
		await this.db
			.update(schema.userMcpServers)
			.set({ enabled })
			.where(
				and(
					eq(schema.userMcpServers.id, serverId),
					inArray(schema.userMcpServers.userId, this.userIdFilters),
				),
			);
	}
}
