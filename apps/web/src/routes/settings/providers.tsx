import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Key, Loader2, Shield } from "lucide-react";
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
	useUpdateUserSettings,
	useUserSettings,
} from "@/web/hooks/use-user-settings";

interface Provider {
	id: string;
	name: string;
	description: string;
	appProvided: boolean;
}

const SUPPORTED_PROVIDERS: Provider[] = [
	{
		id: "openai",
		name: "OpenAI",
		description: "GPT-4o, GPT-4.1, o3 models",
		appProvided: true,
	},
	{
		id: "google",
		name: "Google",
		description: "Gemini 2.5 Flash, Pro",
		appProvided: true,
	},
	{
		id: "llama",
		name: "Meta Llama",
		description: "Llama 3.1, Llama 4 models",
		appProvided: true,
	},
	{
		id: "anthropic",
		name: "Anthropic",
		description: "Claude Opus, Sonnet, Haiku",
		appProvided: false,
	},
];

export const Route = createFileRoute("/settings/providers")({
	component: ProviderSettings,
});

function ProviderSettings() {
	const queryClient = useQueryClient();
	const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
	const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
		null,
	);
	const [apiKeyInput, setApiKeyInput] = useState("");
	const id = useId();

	// Use shared settings hook
	const settingsQuery = useUserSettings();
	const updateSettings = useUpdateUserSettings();

	// Update API keys
	const updateApiKeysMutation = useMutation({
		mutationFn: async (updates: { provider: string; apiKey: string }) => {
			const currentKeys = settingsQuery.data?.apiKeys || {};
			const newKeys = { ...currentKeys, [updates.provider]: updates.apiKey };
			return await updateSettings({ apiKeys: newKeys });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["models", "available"] });
			toast.success("API key saved successfully");
			setShowApiKeyDialog(false);
			setApiKeyInput("");
		},
		onError: (error) => {
			toast.error((error as Error).message);
		},
	});

	const handleSaveApiKey = () => {
		if (!selectedProvider || !apiKeyInput.trim()) {
			toast.error("Please enter a valid API key");
			return;
		}
		updateApiKeysMutation.mutate({
			provider: selectedProvider.id,
			apiKey: apiKeyInput.trim(),
		});
	};

	const openApiKeyDialog = (provider: Provider) => {
		setSelectedProvider(provider);
		setApiKeyInput("");
		setShowApiKeyDialog(true);
	};

	const userApiKeys = settingsQuery.data?.apiKeys || {};

	if (settingsQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const appProvidedProviders = SUPPORTED_PROVIDERS.filter((p) => p.appProvided);
	const byokOnlyProviders = SUPPORTED_PROVIDERS.filter((p) => !p.appProvided);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Provider Configuration</CardTitle>
					<CardDescription>
						Manage API keys for AI providers. Some models are provided free with
						app keys, others require your own API key.
					</CardDescription>
				</CardHeader>
			</Card>

			{/* App-Provided Providers (with basic free models) */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Shield className="h-4 w-4 text-blue-600" />
						<CardTitle>App-Provided Access</CardTitle>
						<Badge variant="outline" className="text-xs">
							Free Models Included
						</Badge>
					</div>
					<CardDescription>
						These providers include free basic models. Add your own API key to
						unlock premium models.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{appProvidedProviders.map((provider) => {
						const hasUserKey = Boolean(userApiKeys[provider.id]);
						return (
							<div
								key={provider.id}
								className="flex flex-col gap-3 rounded-lg border bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
							>
								<div className="flex-1 space-y-1">
									<div className="flex items-center gap-2">
										<h3 className="font-medium text-sm">{provider.name}</h3>
										<Badge
											variant={hasUserKey ? "default" : "secondary"}
											className="text-xs"
										>
											{hasUserKey ? "Custom Key Active" : "Built-In"}
										</Badge>
									</div>
									<p className="text-muted-foreground text-xs">
										{provider.description}
									</p>
									{hasUserKey ? (
										<p className="text-muted-foreground text-xs">
											You're using your own API key for premium models
										</p>
									) : (
										<p className="text-muted-foreground text-xs">
											Using app-provided key for free models only
										</p>
									)}
								</div>
								<Button
									variant={hasUserKey ? "outline" : "default"}
									size="sm"
									onClick={() => openApiKeyDialog(provider)}
								>
									<Key className="mr-2 h-4 w-4" />
									{hasUserKey ? "Update API Key" : "Add Your API Key"}
								</Button>
							</div>
						);
					})}
				</CardContent>
			</Card>

			{/* BYOK Only Providers */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Key className="h-4 w-4 text-amber-600" />
						<CardTitle>Bring Your Own Key</CardTitle>
						<Badge
							variant="outline"
							className="border-amber-200 bg-amber-50 text-amber-700 text-xs"
						>
							API Key Required
						</Badge>
					</div>
					<CardDescription>
						These providers require your own API key to access any models.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{byokOnlyProviders.map((provider) => {
						const hasUserKey = Boolean(userApiKeys[provider.id]);
						return (
							<div
								key={provider.id}
								className="flex flex-col gap-3 rounded-lg border bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
							>
								<div className="flex-1 space-y-1">
									<div className="flex items-center gap-2">
										<h3 className="font-medium text-sm">{provider.name}</h3>
										<Badge
											variant={hasUserKey ? "default" : "secondary"}
											className="text-xs"
										>
											{hasUserKey ? "Connected" : "Not Connected"}
										</Badge>
									</div>
									<p className="text-muted-foreground text-xs">
										{provider.description}
									</p>
									{hasUserKey ? (
										<p className="text-muted-foreground text-xs">
											Your API key is configured and active
										</p>
									) : (
										<p className="text-muted-foreground text-xs">
											Add your API key to unlock these models
										</p>
									)}
								</div>
								<Button
									variant={hasUserKey ? "outline" : "default"}
									size="sm"
									onClick={() => openApiKeyDialog(provider)}
								>
									<Key className="mr-2 h-4 w-4" />
									{hasUserKey ? "Update API Key" : "Add Your API Key"}
								</Button>
							</div>
						);
					})}
				</CardContent>
			</Card>

			{/* API Key Dialog */}
			<Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add API Key for {selectedProvider?.name}</DialogTitle>
						<DialogDescription>
							Enter your {selectedProvider?.name} API key to unlock premium
							models. Your key is stored securely and only used for your
							requests.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor={id}>API Key</Label>
							<Input
								id={id}
								type="password"
								value={apiKeyInput}
								onChange={(e) => setApiKeyInput(e.target.value)}
								placeholder={
									selectedProvider?.id === "openai"
										? "sk-..."
										: selectedProvider?.id === "anthropic"
											? "sk-ant-..."
											: selectedProvider?.id === "google"
												? "AI..."
												: "Enter your API key"
								}
							/>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setShowApiKeyDialog(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={handleSaveApiKey}
								disabled={updateApiKeysMutation.isPending}
							>
								{updateApiKeysMutation.isPending ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Saving...
									</>
								) : (
									"Save API Key"
								)}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
