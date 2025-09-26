import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ModeToggle } from "@/web/components/navigation/mode-toggle";
import { Button } from "@/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/web/components/ui/card";
import { Separator } from "@/web/components/ui/separator";

const densityOptions = [
	{
		id: "comfortable",
		label: "Comfortable",
		description: "Roomy spacing for focused reading",
	},
	{
		id: "cozy",
		label: "Cozy",
		description: "Balanced spacing for everyday work",
	},
	{
		id: "compact",
		label: "Compact",
		description: "High-density layout for power users",
	},
] as const;

export const Route = createFileRoute("/settings/appearance")({
	component: AppearanceSettings,
});

function AppearanceSettings() {
	const [density, setDensity] =
		useState<(typeof densityOptions)[number]["id"]>("cozy");

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Theme</CardTitle>
					<CardDescription>
						Toggle between light and dark mode. This preference syncs with your
						browser storage.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex items-center justify-between gap-4">
					<div>
						<h3 className="font-medium text-sm">Color scheme</h3>
						<p className="text-muted-foreground text-sm">
							Switch themes at any time. We&apos;ll remember your choice next
							visit.
						</p>
					</div>
					<ModeToggle />
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Interface Density</CardTitle>
					<CardDescription>
						Choose how compact the chat and settings layouts should be rendered.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{densityOptions.map((option) => {
						const isActive = density === option.id;
						return (
							<Button
								key={option.id}
								variant={isActive ? "secondary" : "ghost"}
								className="flex h-auto w-full flex-col items-start gap-1 px-4 py-3 text-left"
								onClick={() => setDensity(option.id)}
							>
								<span className="font-medium text-sm">{option.label}</span>
								<span className="text-muted-foreground text-xs">
									{option.description}
								</span>
							</Button>
						);
					})}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Message Layout Preview</CardTitle>
					<CardDescription>
						Density previews help you compare spacing before applying changes
						globally.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4 text-sm">
					<div className="space-y-2 rounded-lg border bg-muted/40 p-4">
						<p className="font-semibold">Assistant</p>
						<p className="text-muted-foreground">
							This preview updates instantly as you switch density presets,
							giving you confidence in your choice before saving.
						</p>
					</div>
					<Separator />
					<p className="text-muted-foreground text-xs">
						UI density preferences are stored locally for now. Coming soon: sync
						across devices via your profile settings.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
