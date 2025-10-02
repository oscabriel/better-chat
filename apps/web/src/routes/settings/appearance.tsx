import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ModeToggle } from "@/web/components/navigation/mode-toggle";
import { Button } from "@/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/web/components/ui/card";
import {
	useUpdateUserSettings,
	useUserSettings,
} from "@/web/hooks/use-user-settings";

const chatWidthOptions = [
	{
		id: "cozy",
		label: "Cozy",
		description: "Focused, centered conversation layout",
	},
	{
		id: "comfortable",
		label: "Comfortable",
		description: "Full-width layout for spacious conversations",
	},
] as const;

export const Route = createFileRoute("/settings/appearance")({
	component: AppearanceSettings,
});

function AppearanceSettings() {
	// Use shared settings hook
	const settingsQuery = useUserSettings();
	const updateSettings = useUpdateUserSettings();

	// Update chat width
	const updateChatWidthMutation = useMutation({
		mutationFn: async (chatWidth: string) => {
			return await updateSettings({ chatWidth });
		},
		onSuccess: () => {
			toast.success("Chat width updated");
		},
		onError: (error) => {
			toast.error((error as Error).message);
		},
	});

	const handleChatWidthChange = (width: string) => {
		updateChatWidthMutation.mutate(width);
	};

	const chatWidth = settingsQuery.data?.chatWidth || "cozy";

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
					<CardTitle>Chat Width</CardTitle>
					<CardDescription>
						Control how wide the main chat interface appears. The sidebar width
						remains constant.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{chatWidthOptions.map((option) => {
						const isActive = chatWidth === option.id;
						return (
							<Button
								key={option.id}
								variant={isActive ? "secondary" : "ghost"}
								className="flex h-auto w-full flex-col items-start gap-1 px-4 py-3 text-left"
								onClick={() => handleChatWidthChange(option.id)}
								disabled={updateChatWidthMutation.isPending}
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
		</div>
	);
}
