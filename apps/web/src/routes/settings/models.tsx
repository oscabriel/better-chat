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

const modelOptions = [
	{
		id: "gpt-4o-mini",
		label: "GPT-4o Mini",
		description: "Balanced for everyday chat and drafting tasks",
		latency: "Low latency",
		capabilities: "Text, code",
	},
	{
		id: "gpt-4.1",
		label: "GPT-4.1",
		description: "Higher fidelity responses for complex workflows",
		latency: "Moderate latency",
		capabilities: "Text, code, function calling",
	},
	{
		id: "claude-3-sonnet",
		label: "Claude 3 Sonnet",
		description: "Anthropic model tuned for nuanced conversations",
		latency: "Moderate latency",
		capabilities: "Text, long context",
	},
] as const;

export const Route = createFileRoute("/settings/models")({
	component: ModelSettings,
});

function ModelSettings() {
	const [primaryModel, setPrimaryModel] = useState(modelOptions[0].id);
	const [fallbackModel, setFallbackModel] = useState(modelOptions[1].id);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Default Assistant Model</CardTitle>
					<CardDescription>
						Choose which model powers new conversations. You can still override
						per chat.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{modelOptions.map((option) => {
						const isActive = option.id === primaryModel;
						return (
							<Button
								key={option.id}
								variant={isActive ? "secondary" : "ghost"}
								className="flex h-auto w-full flex-col items-start gap-1 px-4 py-3 text-left"
								onClick={() => setPrimaryModel(option.id)}
							>
								<div className="flex w-full items-center justify-between gap-3">
									<span className="font-medium text-sm">{option.label}</span>
									<span className="text-muted-foreground text-xs">
										{option.latency}
									</span>
								</div>
								<p className="text-muted-foreground text-xs">
									{option.description}
								</p>
								<p className="text-muted-foreground text-xs">
									Capabilities: {option.capabilities}
								</p>
							</Button>
						);
					})}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Fallback Model</CardTitle>
					<CardDescription>
						Specify which provider we should switch to when the primary model is
						unavailable.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{modelOptions.map((option) => {
						const isActive = option.id === fallbackModel;
						return (
							<Button
								key={option.id}
								variant={isActive ? "secondary" : "ghost"}
								className="flex h-auto w-full flex-col items-start gap-1 px-4 py-3 text-left"
								onClick={() => setFallbackModel(option.id)}
							>
								<span className="font-medium text-sm">{option.label}</span>
								<p className="text-muted-foreground text-xs">
									{option.description}
								</p>
							</Button>
						);
					})}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Execution Policy</CardTitle>
					<CardDescription>
						Fine-tune how we pick models when streaming complex tool calls.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<p>
						Current primary model:{" "}
						<span className="font-medium">{primaryModel}</span>
					</p>
					<p>
						Fallback model: <span className="font-medium">{fallbackModel}</span>
					</p>
					<Separator />
					<p className="text-muted-foreground text-xs">
						These preferences are client-side only for now. When provider
						syncing lands, they&apos;ll be stored with your profile.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
