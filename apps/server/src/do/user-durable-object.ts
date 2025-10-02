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

	/**
	 * Migrates unencrypted API keys to encrypted format.
	 * Only called during getUserSettings, never during updates.
	 */
	private async migrateApiKeysIfNeeded(
		storedApiKeys: Record<string, string>,
		encryptionKey: string,
	): Promise<Record<string, string>> {
		// Check if any keys are unencrypted
		let needsMigration = false;
		for (const key of Object.values(storedApiKeys)) {
			if (key && !isEncrypted(key as string)) {
				needsMigration = true;
				break;
			}
		}

		if (!needsMigration) {
			// All encrypted, just decrypt and return
			return await decryptApiKeys(storedApiKeys, encryptionKey, this.userId);
		}

		// Migration needed: collect all keys (encrypted and unencrypted)
		console.log(`Migrating unencrypted API keys for user ${this.userId}`);
		const plainKeys: Record<string, string> = {};

		for (const [provider, key] of Object.entries(storedApiKeys)) {
			if (!key) continue;

			if (isEncrypted(key as string)) {
				// Already encrypted, decrypt it
				try {
					plainKeys[provider] = await decryptApiKeys(
						{ [provider]: key as string },
						encryptionKey,
						this.userId,
					).then((result) => result[provider]);
				} catch (error) {
					console.error(`Failed to decrypt ${provider} key:`, error);
				}
			} else {
				// Unencrypted, use as-is
				plainKeys[provider] = key as string;
			}
		}

		// Encrypt all keys
		const encryptedKeys = await encryptApiKeys(
			plainKeys,
			encryptionKey,
			this.userId,
		);

		// Save encrypted keys to DB (direct write, no recursion)
		await this.db
			.update(schema.userSettings)
			.set({
				apiKeys: JSON.stringify(encryptedKeys),
				updated: new Date(),
			})
			.where(eq(schema.userSettings.userId, this.userId));

		return plainKeys;
	}

	async getUserSettings(): Promise<{
		selectedModel: string;
		apiKeys: Record<string, string>;
		enabledModels: string[];
		enabledMcpServers: string[];
		theme: string;
		chatWidth: string;
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
				chatWidth: "cozy",
				updated: new Date(),
			};

			await this.db.insert(schema.userSettings).values(defaultSettings);

			return {
				selectedModel: defaultSettings.selectedModel,
				apiKeys: {},
				enabledModels: [],
				enabledMcpServers: JSON.parse(defaultSettings.enabledMcpServers),
				theme: defaultSettings.theme,
				chatWidth: defaultSettings.chatWidth,
			};
		}

		// Decrypt API keys (and migrate if needed)
		const storedApiKeys = settings.apiKeys ? JSON.parse(settings.apiKeys) : {};
		let decryptedApiKeys: Record<string, string> = {};

		const encryptionKey = this.env.API_ENCRYPTION_KEY;
		if (!encryptionKey) {
			console.warn(
				"API_ENCRYPTION_KEY not set - API keys will not be encrypted",
			);
			decryptedApiKeys = storedApiKeys;
		} else {
			try {
				decryptedApiKeys = await this.migrateApiKeysIfNeeded(
					storedApiKeys,
					encryptionKey,
				);
			} catch (error) {
				console.error("Failed to decrypt/migrate API keys:", error);
				decryptedApiKeys = {};
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
			chatWidth: settings.chatWidth || "cozy",
		};
	}

	async updateUserSettings(updates: {
		selectedModel?: string;
		apiKeys?: Record<string, string>;
		enabledModels?: string[];
		enabledMcpServers?: string[];
		theme?: string;
		chatWidth?: string;
	}): Promise<void> {
		// Build the update object
		const updateFields: Record<string, unknown> = {
			updated: new Date(),
		};

		// Only read current settings if we need to merge API keys
		if (updates.apiKeys !== undefined) {
			// For API keys, we need to read current keys to merge
			const current = await this.getUserSettings();
			const mergedKeys = { ...current.apiKeys, ...updates.apiKeys };

			// Encrypt the merged keys
			const encryptionKey = this.env.API_ENCRYPTION_KEY;
			if (encryptionKey) {
				try {
					const encryptedKeys = await encryptApiKeys(
						mergedKeys,
						encryptionKey,
						this.userId,
					);
					updateFields.apiKeys = JSON.stringify(encryptedKeys);
				} catch (error) {
					console.error("Failed to encrypt API keys:", error);
					throw new Error("Failed to encrypt API keys");
				}
			} else {
				console.warn(
					"API_ENCRYPTION_KEY not set - storing API keys without encryption",
				);
				updateFields.apiKeys = JSON.stringify(mergedKeys);
			}
		}

		// For all other fields, just update directly
		if (updates.selectedModel !== undefined) {
			updateFields.selectedModel = updates.selectedModel;
		}
		if (updates.enabledModels !== undefined) {
			updateFields.enabledModels = JSON.stringify(updates.enabledModels);
		}
		if (updates.enabledMcpServers !== undefined) {
			updateFields.enabledMcpServers = JSON.stringify(
				updates.enabledMcpServers,
			);
		}
		if (updates.theme !== undefined) {
			updateFields.theme = updates.theme;
		}
		if (updates.chatWidth !== undefined) {
			updateFields.chatWidth = updates.chatWidth;
		}

		// Perform the update
		await this.db
			.update(schema.userSettings)
			.set(updateFields)
			.where(eq(schema.userSettings.userId, this.userId));
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
