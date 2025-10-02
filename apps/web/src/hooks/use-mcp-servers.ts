import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { parseJsonResponse } from "@/web/utils/chat";

export interface McpServer {
	id: string;
	name: string;
	url: string;
	type: "http" | "sse";
	description?: string;
	headers?: Record<string, string>;
	isBuiltIn: boolean;
	enabled: boolean;
}

export const MCP_SERVERS_QUERY_KEY = ["mcp", "servers"] as const;

type UseMcpServersOptions = Omit<
	UseQueryOptions<McpServer[], Error>,
	"queryKey" | "queryFn"
>;

export function useMcpServers(options?: UseMcpServersOptions) {
	const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;

	return useQuery<McpServer[], Error>({
		queryKey: MCP_SERVERS_QUERY_KEY,
		queryFn: async () => {
			const response = await fetch(`${apiBase}/mcp/servers`, {
				credentials: "include",
			});
			return parseJsonResponse<McpServer[]>(response);
		},
		staleTime: 30_000,
		...options,
	});
}
