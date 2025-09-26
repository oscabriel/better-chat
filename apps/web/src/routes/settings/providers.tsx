import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/web/components/ui/badge";
import { Button } from "@/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/web/components/ui/card";
import { Separator } from "@/web/components/ui/separator";

const providers = [
	{
		id: "openai",
		name: "OpenAI",
		status: "connected" as const,
		lastSynced: "5 minutes ago",
		description: "GPT-4.1, 4o mini, o3 reasoning",
	},
	{
		id: "anthropic",
		name: "Anthropic",
		status: "connected" as const,
		lastSynced: "2 hours ago",
		description: "Claude 3 Opus, Sonnet, Haiku",
	},
	{
		id: "azure-openai",
		name: "Azure OpenAI",
		status: "disconnected" as const,
		lastSynced: null,
		description: "Enterprise-hosted GPT-4.1, GPT-4o",
	},
	{
		id: "google-ai",
		name: "Google AI Studio",
		status: "disconnected" as const,
		lastSynced: null,
		description: "Gemini 1.5 Pro, Flash, 1.0 Ultra",
	},
] as const;

export const Route = createFileRoute("/settings/providers")({
	component: ProviderSettings,
});

function ProviderSettings() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Provider Connections</CardTitle>
					<CardDescription>
						Link your API keys or OAuth connections. We use provider priority to
						pick the best model.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{providers.map((provider) => {
						const isConnected = provider.status === "connected";
						return (
							<div
								key={provider.id}
								className="flex flex-col gap-3 rounded-lg border bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
							>
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<h3 className="font-medium text-sm">{provider.name}</h3>
										<Badge variant={isConnected ? "default" : "secondary"}>
											{isConnected ? "Connected" : "Not connected"}
										</Badge>
									</div>
									<p className="text-muted-foreground text-xs">
										{provider.description}
									</p>
									{isConnected ? (
										<p className="text-muted-foreground text-xs">
											Last synced {provider.lastSynced}
										</p>
									) : (
										<p className="text-muted-foreground text-xs">
											Connect to unlock this provider for conversations
										</p>
									)}
								</div>
								<div className="flex gap-2">
									<Button
										variant={isConnected ? "outline" : "secondary"}
										size="sm"
									>
										{isConnected ? "Manage" : "Connect"}
									</Button>
									<Button variant="ghost" size="sm">
										{isConnected ? "Revoke" : "Docs"}
									</Button>
								</div>
							</div>
						);
					})}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Connection Order</CardTitle>
					<CardDescription>
						We try providers top-to-bottom when a conversation requests a
						specific capability.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<ol className="list-decimal space-y-2 pl-5">
						{providers.map((provider, index) => (
							<li key={provider.id} className="space-y-1">
								<span className="font-medium">
									{index + 1}. {provider.name}
								</span>
								<p className="text-muted-foreground text-xs">
									{provider.status === "connected"
										? "Eligible for auto-selection"
										: "Connect to enable auto-selection"}
								</p>
							</li>
						))}
					</ol>
					<Separator />
					<p className="text-muted-foreground text-xs">
						Drag-and-drop reordering will arrive once provider sync APIs ship.
						For now adjust priority via support.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
