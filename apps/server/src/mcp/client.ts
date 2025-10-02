import {
	StreamableHTTPClientTransport,
	type StreamableHTTPClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { experimental_createMCPClient as createMCPClient } from "ai";
import type { z } from "zod";

export interface MCPServerConfig {
	id: string;
	name: string;
	url: string;
	type: "http" | "sse";
	description: string;
	headers?: Record<string, string>;
	isBuiltIn: boolean;
	schemas?: Record<string, { inputSchema: z.ZodSchema }>;
}

export const BUILT_IN_MCP_SERVERS: MCPServerConfig[] = [
	{
		id: "context7",
		name: "Context7",
		url: "https://mcp.context7.com/mcp",
		type: "http",
		description: "Up-to-date code documentation for LLMs and AI code editors.",
		headers: {},
		isBuiltIn: true,
	},
	{
		id: "cloudflare-docs",
		name: "Cloudflare",
		url: "https://docs.mcp.cloudflare.com/sse",
		type: "sse",
		description: "Get up to date reference information on Cloudflare.",
		headers: {},
		isBuiltIn: true,
	},
];

export async function createMCPClients(serverConfigs: MCPServerConfig[]) {
	const clients = new Map<
		string,
		{
			client: Awaited<ReturnType<typeof createMCPClient>>;
			config: MCPServerConfig;
		}
	>();

	for (const serverConfig of serverConfigs) {
		try {
			const headers = serverConfig.headers;
			let transport:
				| {
						type: "sse";
						url: string;
						headers?: Record<string, string>;
				  }
				| StreamableHTTPClientTransport;

			if (serverConfig.type === "http") {
				const transportOptions:
					| StreamableHTTPClientTransportOptions
					| undefined =
					headers && Object.keys(headers).length > 0
						? { requestInit: { headers } }
						: undefined;
				transport = new StreamableHTTPClientTransport(
					new URL(serverConfig.url),
					transportOptions,
				);
			} else {
				transport = {
					type: "sse",
					url: serverConfig.url,
					headers,
				};
			}

			const client = await createMCPClient({ transport });
			clients.set(serverConfig.id, { client, config: serverConfig });
		} catch (error) {
			console.error(
				`Failed to connect to MCP server ${serverConfig.name}:`,
				error,
			);
		}
	}

	return clients;
}

export async function getMCPTools(serverConfigs: MCPServerConfig[]) {
	const clients = await createMCPClients(serverConfigs);
	const allTools: Record<string, unknown> = {};

	for (const [serverId, { client, config }] of clients) {
		try {
			let tools: Record<string, unknown>;
			if (config.schemas) {
				tools = await client.tools({ schemas: config.schemas });
			} else {
				// Use schema discovery for external servers
				tools = await client.tools();
			}

			// Prefix tool names with server ID to avoid conflicts
			const prefixedTools: Record<string, unknown> = {};
			for (const [toolName, tool] of Object.entries(tools)) {
				prefixedTools[`${serverId}_${toolName}`] = tool;
			}

			Object.assign(allTools, prefixedTools);
		} catch (error) {
			console.error(
				`Failed to load tools from MCP server ${config.name}:`,
				error,
			);
		}
	}

	return { tools: allTools, clients };
}

export async function closeMCPClients(
	clients: Map<
		string,
		{
			client: Awaited<ReturnType<typeof createMCPClient>>;
			config: MCPServerConfig;
		}
	>,
) {
	for (const [serverId, { client }] of clients) {
		try {
			await client.close();
		} catch (error) {
			console.error(`Failed to close MCP client ${serverId}:`, error);
		}
	}
}
