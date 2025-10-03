import {
	addCustomMcpServer,
	getCustomMcpServers,
	getUserSettingsRecord,
	removeCustomMcpServer,
	toggleCustomMcpServer,
	updateUserSettingsRecord,
} from "@/server/lib/user-settings";
import type { MCPServerConfig } from "@/server/mcp/client";
import { BUILT_IN_MCP_SERVERS } from "@/server/mcp/client";

export interface UserMCPServer {
	id: string;
	userId: string;
	name: string;
	url: string;
	type: "http" | "sse";
	description?: string;
	headers?: Record<string, string>;
	enabled: boolean;
	created: Date;
}

export class MCPServerManager {
	constructor(private readonly userId: string) {}

	async getUserMCPServers(): Promise<MCPServerConfig[]> {
		const customServers = await getCustomMcpServers(this.userId);
		const settings = await getUserSettingsRecord(this.userId);
		const enabledBuiltInIds = settings.enabledMcpServers || [];

		const enabledBuiltIn = BUILT_IN_MCP_SERVERS.filter((server) =>
			enabledBuiltInIds.includes(server.id),
		);

		const enabledCustom: MCPServerConfig[] = customServers
			.filter((server) => server.enabled)
			.map((server) => ({
				id: server.id,
				name: server.name,
				url: server.url,
				type: server.type,
				description: server.description || "",
				headers: server.headers,
				isBuiltIn: false,
			}));

		return [...enabledBuiltIn, ...enabledCustom];
	}

	async addCustomMCPServer(serverData: {
		name: string;
		url: string;
		type: "http" | "sse";
		description?: string;
		headers?: Record<string, string>;
	}): Promise<string> {
		const serverId = `custom_${Date.now()}`;

		await addCustomMcpServer(this.userId, {
			id: serverId,
			name: serverData.name,
			url: serverData.url,
			type: serverData.type,
			description: serverData.description,
			headers: serverData.headers,
			enabled: true,
			created: new Date(),
		});

		return serverId;
	}

	async removeCustomMCPServer(serverId: string): Promise<void> {
		await removeCustomMcpServer(this.userId, serverId);
	}

	async toggleMCPServer(serverId: string, enabled: boolean): Promise<void> {
		if (serverId.startsWith("custom_")) {
			await toggleCustomMcpServer(this.userId, serverId, enabled);
		} else {
			const settings = await getUserSettingsRecord(this.userId);
			let enabledServers = settings.enabledMcpServers || [];

			if (enabled) {
				if (!enabledServers.includes(serverId)) {
					enabledServers = [...enabledServers, serverId];
				}
			} else {
				enabledServers = enabledServers.filter((id) => id !== serverId);
			}

			await updateUserSettingsRecord(this.userId, {
				enabledMcpServers: enabledServers,
			});
		}
	}
}
