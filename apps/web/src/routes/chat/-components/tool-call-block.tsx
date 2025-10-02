import {
	ChevronDown,
	ChevronRight,
	Database,
	FileText,
	Globe,
	Search,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/web/components/ui/badge";
import { Button } from "@/web/components/ui/button";
import { Card } from "@/web/components/ui/card";
import { useMcpServers } from "@/web/hooks/use-mcp-servers";

interface ToolCallBlockProps {
	part: {
		type: string;
		toolName?: string;
		input?: unknown;
		output?: unknown;
		state?: string;
		errorText?: string;
	};
}

export function ToolCallBlock({ part }: ToolCallBlockProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const { data: mcpServers } = useMcpServers();

	// Helper to extract server and tool name from prefixed tool names
	const parseToolName = (toolName: string) => {
		// Find the server whose ID is a prefix of this tool name
		for (const server of mcpServers ?? []) {
			if (toolName.startsWith(`${server.id}_`)) {
				const actualToolName = toolName.slice(server.id.length + 1);
				return { server, actualToolName };
			}
		}
		// Fallback for unknown servers
		return { server: undefined, actualToolName: toolName };
	};

	const getToolIcon = (toolName: string) => {
		const { actualToolName } = parseToolName(toolName);
		const lowerToolName = actualToolName.toLowerCase();

		// Match based on tool name keywords
		if (
			lowerToolName.includes("search") ||
			lowerToolName.includes("docs") ||
			lowerToolName.includes("documentation")
		) {
			return <Search className="h-4 w-4" />;
		}
		if (
			lowerToolName.includes("database") ||
			lowerToolName.includes("query") ||
			lowerToolName.includes("sql")
		) {
			return <Database className="h-4 w-4" />;
		}
		if (
			lowerToolName.includes("web") ||
			lowerToolName.includes("http") ||
			lowerToolName.includes("fetch") ||
			lowerToolName.includes("url")
		) {
			return <Globe className="h-4 w-4" />;
		}

		// Default icon
		return <FileText className="h-4 w-4" />;
	};

	const getToolDisplayName = (toolName: string) => {
		const { server, actualToolName } = parseToolName(toolName);

		const toolNameMap: Record<string, string> = {
			search: "Search",
			get_docs: "Get Documentation",
			find_examples: "Find Examples",
			list_apis: "List APIs",
		};

		const serverName = server?.name || "Unknown Server";
		const toolDisplayName =
			toolNameMap[actualToolName] || actualToolName || "Unknown Tool";

		return `${serverName} - ${toolDisplayName}`;
	};

	const getServerInfo = (toolName: string) => {
		const { server } = parseToolName(toolName);

		if (!server) return undefined;

		let displayUrl = server.url;
		try {
			const parsed = new URL(server.url);
			displayUrl = parsed.host + parsed.pathname;
		} catch (_error) {
			// leave displayUrl as-is if parsing fails (e.g., custom schemes)
		}

		return {
			url: displayUrl,
			type: server.type.toUpperCase(),
		};
	};

	const getStateColor = (state: string) => {
		switch (state) {
			case "input-streaming":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
			case "input-available":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
			case "output-available":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
			case "output-error":
				return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
		}
	};

	const getStateText = (state: string) => {
		switch (state) {
			case "input-streaming":
				return "Processing...";
			case "input-available":
				return "Searching...";
			case "output-available":
				return "Complete";
			case "output-error":
				return "Error";
			default:
				return state;
		}
	};

	const toolName = part.toolName || "unknown";
	const serverInfo = getServerInfo(toolName);

	// Handle different tool call states
	if (part.state === "input-streaming" || part.state === "input-available") {
		return (
			<Card className="gap-3 border-l-4 border-l-blue-500 py-3">
				<div className="space-y-3 px-3">
					<div className="flex items-center gap-2">
						{getToolIcon(toolName)}
						<span className="font-medium text-sm">
							{getToolDisplayName(toolName)}
						</span>
						<Badge className={getStateColor(part.state)}>
							{getStateText(part.state)}
						</Badge>
						{serverInfo && (
							<Badge variant="outline" className="text-xs">
								{serverInfo.type}
							</Badge>
						)}
					</div>

					{part.input !== undefined && (
						<div className="text-muted-foreground text-sm">
							<pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">
								{JSON.stringify(part.input, null, 2)}
							</pre>
						</div>
					)}
				</div>
			</Card>
		);
	}

	if (part.state === "output-available") {
		return (
			<Card className="gap-3 border-l-4 border-l-green-500 py-3">
				<div className="space-y-3 px-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex flex-wrap items-center gap-1.5">
							{getToolIcon(toolName)}
							<span className="font-medium text-sm">
								{getToolDisplayName(toolName)}
							</span>
							<Badge className={getStateColor(part.state)}>
								{getStateText(part.state)}
							</Badge>
							{serverInfo && (
								<Badge variant="outline" className="text-xs">
									{serverInfo.type}
								</Badge>
							)}
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs"
							onClick={() => setIsExpanded(!isExpanded)}
						>
							{isExpanded ? (
								<ChevronDown className="h-3 w-3" />
							) : (
								<ChevronRight className="h-3 w-3" />
							)}
							<span className="ml-1">Details</span>
						</Button>
					</div>

					{isExpanded && (
						<div className="mt-3 space-y-3 border-t pt-3 text-sm">
							<div>
								<h4 className="mb-2 font-medium text-muted-foreground text-xs">
									Input:
								</h4>
								<pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">
									{JSON.stringify(part.input, null, 2)}
								</pre>
							</div>
							<div>
								<h4 className="mb-2 font-medium text-muted-foreground text-xs">
									Full Results:
								</h4>
								<div className="max-h-60 overflow-y-auto rounded bg-muted p-2 text-xs">
									{typeof part.output === "string"
										? part.output
										: JSON.stringify(part.output, null, 2)}
								</div>
							</div>
						</div>
					)}
				</div>
			</Card>
		);
	}

	if (part.state === "output-error") {
		return (
			<Card className="gap-3 border-l-4 border-l-red-500 py-3">
				<div className="space-y-3 px-3">
					<div className="flex flex-wrap items-center gap-1.5">
						{getToolIcon(toolName)}
						<span className="font-medium text-sm">
							{getToolDisplayName(toolName)}
						</span>
						<Badge className={getStateColor(part.state)}>
							{getStateText(part.state)}
						</Badge>
						{serverInfo && (
							<Badge variant="outline" className="text-xs">
								{serverInfo.type}
							</Badge>
						)}
					</div>
					<div className="text-destructive text-xs">
						Error: {part.errorText || "Unknown error occurred"}
					</div>
				</div>
			</Card>
		);
	}

	// Fallback for other tool call types
	return (
		<Card className="gap-3 border-l-4 border-l-gray-500 py-3">
			<div className="space-y-3 px-3">
				<div className="flex flex-wrap items-center gap-1.5">
					{getToolIcon(toolName)}
					<span className="font-medium text-sm">
						{getToolDisplayName(toolName)}
					</span>
					{serverInfo && (
						<Badge variant="outline" className="text-xs">
							{serverInfo.type}
						</Badge>
					)}
				</div>
				<pre className="whitespace-pre-wrap rounded bg-muted p-1.5 text-xs">
					{JSON.stringify(part, null, 2)}
				</pre>
			</div>
		</Card>
	);
}
