import type { UserDurableObject } from "@/server/do/user-durable-object";
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
	private stub: UserDurableObject;

	constructor(stub: UserDurableObject) {
		this.stub = stub;
	}

	async getUserMCPServers(): Promise<MCPServerConfig[]> {
		// Get user's custom MCP servers from database
		const customServers = await this.stub.getCustomMCPServers();

		// Get user's enabled built-in servers from settings
		const settings = await this.stub.getUserSettings();
		const enabledBuiltInIds = settings.enabledMcpServers || [];

		// Combine built-in and custom servers
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

		await this.stub.addCustomMCPServer({
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
		await this.stub.removeCustomMCPServer(serverId);
	}

	async toggleMCPServer(serverId: string, enabled: boolean): Promise<void> {
		if (serverId.startsWith("custom_")) {
			// Toggle custom server
			await this.stub.toggleCustomMCPServer(serverId, enabled);
		} else {
			// Toggle built-in server in user settings
			const settings = await this.stub.getUserSettings();
			let enabledServers = settings.enabledMcpServers || [];

			if (enabled) {
				if (!enabledServers.includes(serverId)) {
					enabledServers.push(serverId);
				}
			} else {
				enabledServers = enabledServers.filter((id) => id !== serverId);
			}

			await this.stub.updateUserSettings({ enabledMcpServers: enabledServers });
		}
	}
}
