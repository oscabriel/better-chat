import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/web/components/ui/card";
import { Separator } from "@/web/components/ui/separator";

const tools = [
	{
		id: "web-search",
		label: "Web Search",
		description: "Allow the assistant to browse indexed sources when answering",
	},
	{
		id: "code-executor",
		label: "Code Runner",
		description: "Execute small TypeScript snippets inside a sandbox",
	},
	{
		id: "notion",
		label: "Notion",
		description: "Sync knowledge base pages into context-aware conversations",
	},
	{
		id: "github",
		label: "GitHub",
		description: "Reference repositories and pull requests directly from chat",
	},
] as const;

export const Route = createFileRoute("/settings/tools")({
	component: ToolSettings,
});

function ToolSettings() {
	const [enabledTools, setEnabledTools] = useState<Set<string>>(
		new Set(["web-search", "code-executor"]),
	);

	const toggleTool = (id: string) => {
		setEnabledTools((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Tool Integrations</CardTitle>
					<CardDescription>
						Enable capabilities your workspace relies on. Tools run on a
						per-conversation basis.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{tools.map((tool) => {
						const isEnabled = enabledTools.has(tool.id);
						return (
							<div
								key={tool.id}
								className="flex flex-col gap-3 rounded-lg border bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between"
							>
								<div>
									<h3 className="font-medium text-sm">{tool.label}</h3>
									<p className="text-muted-foreground text-xs">
										{tool.description}
									</p>
								</div>
								<Button
									variant={isEnabled ? "outline" : "secondary"}
									onClick={() => toggleTool(tool.id)}
									size="sm"
								>
									{isEnabled ? "Disable" : "Enable"}
								</Button>
							</div>
						);
					})}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Automation Defaults</CardTitle>
					<CardDescription>
						Choose which tools should auto-run when a new chat starts.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					{tools.map((tool) => (
						<div key={tool.id} className="flex items-center justify-between">
							<span>{tool.label}</span>
							<Button
								variant={enabledTools.has(tool.id) ? "secondary" : "ghost"}
								size="sm"
							>
								{enabledTools.has(tool.id) ? "Auto" : "Manual"}
							</Button>
						</div>
					))}
					<Separator />
					<p className="text-muted-foreground text-xs">
						We&apos;ll add fine-grained triggers later (per prompt, schedule,
						channel). Today this toggles a workspace default.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
