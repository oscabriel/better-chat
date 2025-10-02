import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Loader2, Plus, Settings, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/web/components/ui/badge";
import { Button } from "@/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/web/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/web/components/ui/dialog";
import { Input } from "@/web/components/ui/input";
import { Label } from "@/web/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/web/components/ui/select";
import { Switch } from "@/web/components/ui/switch";
import { Textarea } from "@/web/components/ui/textarea";
import {
	MCP_SERVERS_QUERY_KEY,
	useMcpServers,
} from "@/web/hooks/use-mcp-servers";
import { parseJsonResponse } from "@/web/utils/chat";

export const Route = createFileRoute("/settings/tools")({
	component: ToolsPage,
});

function ToolsPage() {
	const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;
	const queryClient = useQueryClient();
	const [showAddDialog, setShowAddDialog] = useState(false);
	const id = useId();
	const [newServer, setNewServer] = useState({
		name: "",
		url: "",
		type: "http" as "http" | "sse",
		description: "",
		headers: {} as Record<string, string>,
	});
	const [headerKey, setHeaderKey] = useState("");
	const [headerValue, setHeaderValue] = useState("");

	// Fetch MCP servers
	const serversQuery = useMcpServers();

	// Add custom MCP server
	const addServerMutation = useMutation({
		mutationFn: async (serverData: typeof newServer) => {
			const response = await fetch(`${apiBase}/mcp/servers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(serverData),
			});
			if (!response.ok) throw new Error("Failed to add server");
			return parseJsonResponse(response);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: MCP_SERVERS_QUERY_KEY });
			toast.success("MCP server added successfully");
			setShowAddDialog(false);
			setNewServer({
				name: "",
				url: "",
				type: "http",
				description: "",
				headers: {},
			});
			setHeaderKey("");
			setHeaderValue("");
		},
		onError: (error) => {
			toast.error((error as Error).message);
		},
	});

	// Toggle MCP server
	const toggleServerMutation = useMutation({
		mutationFn: async ({
			serverId,
			enabled,
		}: {
			serverId: string;
			enabled: boolean;
		}) => {
			const response = await fetch(
				`${apiBase}/mcp/servers/${serverId}/toggle`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ enabled }),
				},
			);
			if (!response.ok) throw new Error("Failed to toggle server");
			return parseJsonResponse(response);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: MCP_SERVERS_QUERY_KEY });
		},
		onError: (error) => {
			toast.error((error as Error).message);
		},
	});

	// Remove custom MCP server
	const removeServerMutation = useMutation({
		mutationFn: async (serverId: string) => {
			const response = await fetch(`${apiBase}/mcp/servers/${serverId}`, {
				method: "DELETE",
				credentials: "include",
			});
			if (!response.ok) throw new Error("Failed to remove server");
			return parseJsonResponse(response);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: MCP_SERVERS_QUERY_KEY });
			toast.success("MCP server removed successfully");
		},
		onError: (error) => {
			toast.error((error as Error).message);
		},
	});

	const handleAddServer = () => {
		if (!newServer.name || !newServer.url) {
			toast.error("Please fill in all required fields");
			return;
		}
		addServerMutation.mutate(newServer);
	};

	const isLoading = serversQuery.isLoading;
	const mcpServers = serversQuery.data || [];

	// Helper functions for header management
	const addHeader = () => {
		if (headerKey && headerValue) {
			setNewServer((prev) => ({
				...prev,
				headers: { ...prev.headers, [headerKey]: headerValue },
			}));
			setHeaderKey("");
			setHeaderValue("");
		}
	};

	const removeHeader = (key: string) => {
		setNewServer((prev) => {
			const newHeaders = { ...prev.headers };
			delete newHeaders[key];
			return { ...prev, headers: newHeaders };
		});
	};

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Documentation Tools</CardTitle>
							<CardDescription>
								Configure which documentation sources the AI can search
							</CardDescription>
						</div>

						<Button onClick={() => setShowAddDialog(true)}>
							<Plus className="mr-2 h-4 w-4" />
							Add MCP Server
						</Button>
					</div>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>MCP Servers</CardTitle>
					<CardDescription>
						{mcpServers.length} server{mcpServers.length !== 1 ? "s" : ""}{" "}
						configured
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{mcpServers.map((server) => (
						<Card key={server.id} className="border-2">
							<CardContent className="p-4">
								<div className="flex items-start justify-between">
									<div className="flex-1 space-y-2">
										<div className="flex items-center gap-2">
											<h3 className="font-medium">{server.name}</h3>
											{server.isBuiltIn ? (
												<Badge variant="secondary" className="text-xs">
													Built-in
												</Badge>
											) : (
												<Badge variant="outline" className="text-xs">
													Custom
												</Badge>
											)}
											<Badge variant="outline" className="text-xs uppercase">
												{server.type}
											</Badge>
											{server.enabled && (
												<Badge variant="default" className="text-xs">
													Enabled
												</Badge>
											)}
										</div>

										<p className="text-muted-foreground text-sm">
											{server.description}
										</p>

										<div className="flex items-center gap-2 text-muted-foreground text-xs">
											<ExternalLink className="h-3 w-3" />
											<span className="font-mono">{server.url}</span>
										</div>
									</div>

									<div className="ml-4 flex items-center gap-2">
										{!server.isBuiltIn && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => removeServerMutation.mutate(server.id)}
												className="text-destructive hover:text-destructive"
												disabled={removeServerMutation.isPending}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										)}
										<Switch
											checked={server.enabled}
											onCheckedChange={(enabled: boolean) =>
												toggleServerMutation.mutate({
													serverId: server.id,
													enabled,
												})
											}
											disabled={toggleServerMutation.isPending}
										/>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</CardContent>
			</Card>

			{mcpServers.length === 0 && (
				<Card>
					<CardContent className="p-8 text-center">
						<Settings className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
						<h3 className="mb-2 font-medium text-lg">
							No MCP Servers Configured
						</h3>
						<p className="mb-4 text-muted-foreground">
							Add your first MCP server to enable documentation search
							capabilities
						</p>
						<Button onClick={() => setShowAddDialog(true)}>
							<Plus className="mr-2 h-4 w-4" />
							Add MCP Server
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Add Server Dialog */}
			<Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Custom MCP Server</DialogTitle>
						<DialogDescription>
							Add a new MCP server to extend AI capabilities
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor={id}>Name</Label>
							<Input
								id={id}
								value={newServer.name}
								onChange={(e) =>
									setNewServer((prev) => ({ ...prev, name: e.target.value }))
								}
								placeholder="Custom Documentation Server"
							/>
						</div>

						<div>
							<Label htmlFor={id}>Server URL*</Label>
							<Input
								id={id}
								value={newServer.url}
								onChange={(e) =>
									setNewServer((prev) => ({ ...prev, url: e.target.value }))
								}
								placeholder="https://api.example.com/mcp"
							/>
						</div>

						<div>
							<Label htmlFor={id}>Transport Type*</Label>
							<Select
								value={newServer.type}
								onValueChange={(value: "http" | "sse") =>
									setNewServer((prev) => ({ ...prev, type: value }))
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select transport type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="http">HTTP (Recommended)</SelectItem>
									<SelectItem value="sse">Server-Sent Events (SSE)</SelectItem>
								</SelectContent>
							</Select>
							<p className="mt-2 text-muted-foreground text-xs">
								Use HTTP for production deployments. SSE remains available for
								servers that only expose streaming endpoints.
							</p>
						</div>

						<div>
							<Label htmlFor={id}>Description (Optional)</Label>
							<Textarea
								id={id}
								value={newServer.description}
								onChange={(e) =>
									setNewServer((prev) => ({
										...prev,
										description: e.target.value,
									}))
								}
								placeholder="What does this server provide?"
								rows={3}
							/>
						</div>

						<div>
							<Label>Headers (Optional)</Label>
							<div className="space-y-2">
								<div className="flex gap-2">
									<Input
										placeholder="Header name (e.g., x-api-key)"
										value={headerKey}
										onChange={(e) => setHeaderKey(e.target.value)}
										className="flex-1"
									/>
									<Input
										placeholder="Header value"
										value={headerValue}
										onChange={(e) => setHeaderValue(e.target.value)}
										className="flex-1"
									/>
									<Button
										variant="outline"
										onClick={addHeader}
										disabled={!headerKey || !headerValue}
									>
										<Plus className="h-4 w-4" />
									</Button>
								</div>
								{Object.entries(newServer.headers || {}).length > 0 && (
									<div className="space-y-1 rounded border p-2">
										{Object.entries(newServer.headers || {}).map(
											([key, value]) => (
												<div
													key={key}
													className="flex items-center justify-between rounded bg-muted px-2 py-1 text-sm"
												>
													<span className="font-mono">
														{key}: {value}
													</span>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => removeHeader(key)}
														className="h-6 w-6 p-0"
													>
														<Trash2 className="h-3 w-3" />
													</Button>
												</div>
											),
										)}
									</div>
								)}
							</div>
						</div>

						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setShowAddDialog(false)}>
								Cancel
							</Button>
							<Button
								onClick={handleAddServer}
								disabled={
									addServerMutation.isPending ||
									!newServer.name ||
									!newServer.url
								}
							>
								{addServerMutation.isPending ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Adding...
									</>
								) : (
									"Add Server"
								)}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
