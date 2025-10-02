import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2, ShieldCheck, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/web/components/ui/badge";
import { Button } from "@/web/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/web/components/ui/dialog";
import { ScrollArea } from "@/web/components/ui/scroll-area";
import { Switch } from "@/web/components/ui/switch";
import {
	MCP_SERVERS_QUERY_KEY,
	useMcpServers,
} from "@/web/hooks/use-mcp-servers";
import { parseJsonResponse } from "@/web/utils/chat";

interface TogglePayload {
	serverId: string;
	enabled: boolean;
}

export function McpServersDialogButton({ disabled }: { disabled?: boolean }) {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();
	const {
		data: servers = [],
		isLoading,
		isFetching,
	} = useMcpServers({
		enabled: open,
	});

	const toggleMutation = useMutation({
		mutationFn: async ({ serverId, enabled }: TogglePayload) => {
			const response = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/mcp/servers/${serverId}/toggle`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ enabled }),
				},
			);
			return parseJsonResponse(response);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: MCP_SERVERS_QUERY_KEY });
		},
	});

	const sortedServers = useMemo(() => {
		return [...servers].sort((a, b) => {
			if (a.isBuiltIn === b.isBuiltIn) {
				return a.name.localeCompare(b.name);
			}
			return a.isBuiltIn ? -1 : 1;
		});
	}, [servers]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-9 px-2"
					disabled={disabled}
					title="View and toggle MCP servers"
				>
					<Settings2 className="mr-2 h-4 w-4" />
					MCP Servers
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Model Context Protocol Servers</DialogTitle>
					<DialogDescription>
						Enable or disable documentation/tool providers available to the
						assistant.
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="max-h-80 space-y-3 pr-2">
					{isLoading || isFetching ? (
						<div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
							Loading servers...
						</div>
					) : sortedServers.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground text-sm">
							<Wrench className="h-5 w-5" />
							<span>No MCP servers configured yet.</span>
						</div>
					) : (
						<div className="space-y-3">
							{sortedServers.map((server) => {
								const isMutating = toggleMutation.isPending;
								return (
									<div
										key={server.id}
										className="flex items-start justify-between rounded-md border p-3"
									>
										<div className="space-y-1.5">
											<div className="flex flex-wrap items-center gap-2">
												<span className="font-medium text-sm">
													{server.name}
												</span>
												{server.isBuiltIn ? (
													<Badge variant="secondary" className="text-xs">
														Built-in
													</Badge>
												) : (
													<Badge variant="outline" className="text-xs">
														Custom
													</Badge>
												)}
												<Badge variant="outline" className="text-xs">
													{server.type.toUpperCase()}
												</Badge>
											</div>
											{server.description ? (
												<p className="text-muted-foreground text-xs">
													{server.description}
												</p>
											) : null}
											<p className="font-mono text-[11px] text-muted-foreground">
												{(() => {
													try {
														const parsed = new URL(server.url);
														return parsed.host + parsed.pathname;
													} catch (_error) {
														return server.url;
													}
												})()}
											</p>
										</div>
										<Switch
											checked={server.enabled}
											onCheckedChange={(checked) =>
												toggleMutation.mutate({
													serverId: server.id,
													enabled: checked,
												})
											}
											disabled={isMutating}
											className="ml-4"
										/>
									</div>
								);
							})}
						</div>
					)}
				</ScrollArea>
				<div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-muted-foreground text-xs">
					<div className="items-centered flex gap-2">
						<ShieldCheck className="h-3.5 w-3.5" />
						<span>
							Changes apply instantly and affect all new AI responses.
						</span>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
