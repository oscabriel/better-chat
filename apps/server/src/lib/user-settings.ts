import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { userMcpServers, userSettings } from "@/server/db/schema/settings";
import {
	decryptApiKeys,
	encryptApiKeys,
	isEncrypted,
} from "@/server/lib/crypto";

export const DEFAULT_MODEL_ID = "google:gemini-2.5-flash-lite";
const DEFAULT_ENABLED_MCP_SERVERS = ["context7"] as const;

export type UserSettingsRecord = {
	selectedModel: string;
	apiKeys: Record<string, string>;
	enabledModels: string[];
	enabledMcpServers: string[];
	theme: string;
	chatWidth: string;
};

export type UserMcpServerRecord = {
	id: string;
	userId: string;
	name: string;
	url: string;
	type: "http" | "sse";
	description?: string;
	headers?: Record<string, string>;
	enabled: boolean;
	created: Date;
};

const DEFAULT_SETTINGS: UserSettingsRecord = {
	selectedModel: DEFAULT_MODEL_ID,
	apiKeys: {},
	enabledModels: [],
	enabledMcpServers: [...DEFAULT_ENABLED_MCP_SERVERS],
	theme: "system",
	chatWidth: "cozy",
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
	if (!value) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch (error) {
		console.warn("Failed to parse JSON value", { value, error });
		return fallback;
	}
}

async function ensureSettingsRow(userId: string): Promise<void> {
	const now = new Date();
	await db
		.insert(userSettings)
		.values({
			userId,
			selectedModel: DEFAULT_SETTINGS.selectedModel,
			apiKeys: JSON.stringify({}),
			enabledModels: JSON.stringify(DEFAULT_SETTINGS.enabledModels),
			enabledMcpServers: JSON.stringify(DEFAULT_SETTINGS.enabledMcpServers),
			theme: DEFAULT_SETTINGS.theme,
			chatWidth: DEFAULT_SETTINGS.chatWidth,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing({ target: userSettings.userId });
}

async function migrateApiKeysIfNeeded(
	userId: string,
	storedApiKeys: Record<string, string>,
): Promise<Record<string, string>> {
	const encryptionKey = env.API_ENCRYPTION_KEY;
	if (!encryptionKey) {
		return storedApiKeys;
	}

	let needsMigration = false;
	for (const key of Object.values(storedApiKeys)) {
		if (key && !isEncrypted(key)) {
			needsMigration = true;
			break;
		}
	}

	if (!needsMigration) {
		return await decryptApiKeys(storedApiKeys, encryptionKey, userId);
	}

	const plainKeys: Record<string, string> = {};

	for (const [provider, key] of Object.entries(storedApiKeys)) {
		if (!key) continue;

		if (isEncrypted(key)) {
			// Decrypt - will throw if decryption fails
			plainKeys[provider] = await decryptApiKeys(
				{ [provider]: key },
				encryptionKey,
				userId,
			).then((result) => result[provider]);
		} else {
			plainKeys[provider] = key;
		}
	}

	const encryptedKeys = await encryptApiKeys(plainKeys, encryptionKey, userId);

	await db
		.update(userSettings)
		.set({
			apiKeys: JSON.stringify(encryptedKeys),
			updatedAt: new Date(),
		})
		.where(eq(userSettings.userId, userId));

	return plainKeys;
}

export async function getUserSettingsRecord(
	userId: string,
): Promise<UserSettingsRecord> {
	await ensureSettingsRow(userId);

	const row = await db
		.select()
		.from(userSettings)
		.where(eq(userSettings.userId, userId))
		.get();

	if (!row) {
		return { ...DEFAULT_SETTINGS };
	}

	const storedApiKeys = parseJson<Record<string, string>>(row.apiKeys, {});
	const encryptionKey = env.API_ENCRYPTION_KEY;

	let apiKeys: Record<string, string> = {};

	if (!encryptionKey) {
		apiKeys = storedApiKeys;
	} else {
		// Let decryption errors propagate - caller should handle them
		apiKeys = await migrateApiKeysIfNeeded(userId, storedApiKeys);
	}

	return {
		selectedModel: row.selectedModel ?? DEFAULT_SETTINGS.selectedModel,
		apiKeys,
		enabledModels: parseJson<string[]>(row.enabledModels, []),
		enabledMcpServers: parseJson<string[]>(row.enabledMcpServers, [
			...DEFAULT_ENABLED_MCP_SERVERS,
		]),
		theme: row.theme ?? DEFAULT_SETTINGS.theme,
		chatWidth: row.chatWidth ?? DEFAULT_SETTINGS.chatWidth,
	};
}

export async function updateUserSettingsRecord(
	userId: string,
	updates: Partial<UserSettingsRecord> & {
		apiKeys?: Record<string, string>;
	},
): Promise<UserSettingsRecord> {
	await ensureSettingsRow(userId);

	const updateFields: Partial<typeof userSettings.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (updates.selectedModel !== undefined) {
		updateFields.selectedModel = updates.selectedModel;
	}
	if (updates.enabledModels !== undefined) {
		updateFields.enabledModels = JSON.stringify(updates.enabledModels);
	}
	if (updates.enabledMcpServers !== undefined) {
		updateFields.enabledMcpServers = JSON.stringify(updates.enabledMcpServers);
	}
	if (updates.theme !== undefined) {
		updateFields.theme = updates.theme;
	}
	if (updates.chatWidth !== undefined) {
		updateFields.chatWidth = updates.chatWidth;
	}

	if (updates.apiKeys !== undefined) {
		const current = await getUserSettingsRecord(userId);
		const merged = { ...current.apiKeys, ...updates.apiKeys };
		const encryptionKey = env.API_ENCRYPTION_KEY;

		if (encryptionKey) {
			const encrypted = await encryptApiKeys(merged, encryptionKey, userId);
			updateFields.apiKeys = JSON.stringify(encrypted);
		} else {
			updateFields.apiKeys = JSON.stringify(merged);
		}
	}

	await db
		.update(userSettings)
		.set(updateFields)
		.where(eq(userSettings.userId, userId));

	return getUserSettingsRecord(userId);
}

export async function getCustomMcpServers(
	userId: string,
): Promise<UserMcpServerRecord[]> {
	const rows = await db
		.select()
		.from(userMcpServers)
		.where(eq(userMcpServers.userId, userId))
		.all();

	return rows.map((row) => ({
		id: row.id,
		userId: row.userId,
		name: row.name,
		url: row.url,
		type: (row.type as "http" | "sse") ?? "http",
		description: row.description ?? undefined,
		headers: parseJson<Record<string, string> | undefined>(
			row.headers,
			undefined,
		),
		enabled: Boolean(row.enabled ?? true),
		created:
			row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
	}));
}

export async function addCustomMcpServer(
	userId: string,
	server: {
		id: string;
		name: string;
		url: string;
		type: "http" | "sse";
		description?: string;
		headers?: Record<string, string>;
		enabled?: boolean;
		created?: Date;
	},
): Promise<void> {
	await db.insert(userMcpServers).values({
		id: server.id,
		userId,
		name: server.name,
		url: server.url,
		type: server.type,
		description: server.description,
		headers: JSON.stringify(server.headers ?? {}),
		enabled: server.enabled ?? true,
		createdAt: server.created ?? new Date(),
	});
}

export async function removeCustomMcpServer(
	userId: string,
	serverId: string,
): Promise<void> {
	await db
		.delete(userMcpServers)
		.where(
			and(eq(userMcpServers.id, serverId), eq(userMcpServers.userId, userId)),
		);
}

export async function toggleCustomMcpServer(
	userId: string,
	serverId: string,
	enabled: boolean,
): Promise<void> {
	await db
		.update(userMcpServers)
		.set({ enabled })
		.where(
			and(eq(userMcpServers.id, serverId), eq(userMcpServers.userId, userId)),
		);
}
