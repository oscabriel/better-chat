import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Crown, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/web/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/web/components/ui/card";
import { Switch } from "@/web/components/ui/switch";
import { parseJsonResponse } from "@/web/utils/chat";

interface ModelDefinition {
	id: string;
	name: string;
	provider: string;
	description: string;
	access: "free" | "byok";
	capabilities: string[];
	contextWindow: number;
	maxOutputTokens?: number;
	costPer1kTokens?: {
		input: number;
		output: number;
	};
}

interface UserSettings {
	selectedModel: string;
	apiKeys: Record<string, string>;
	enabledModels: string[];
	enabledMcpServers: string[];
	theme: string;
}

export const Route = createFileRoute("/settings/models")({
	component: ModelSettings,
});

function ModelSettings() {
	const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;
	const queryClient = useQueryClient();

	// Fetch all models
	const modelsQuery = useQuery<ModelDefinition[]>({
		queryKey: ["models", "all"],
		queryFn: async () => {
			const response = await fetch(`${apiBase}/models/all`, {
				credentials: "include",
			});
			return parseJsonResponse<ModelDefinition[]>(response);
		},
		staleTime: 60_000,
	});

	// Fetch user settings
	const settingsQuery = useQuery<UserSettings>({
		queryKey: ["user", "settings"],
		queryFn: async () => {
			const response = await fetch(`${apiBase}/user/settings`, {
				credentials: "include",
			});
			return parseJsonResponse<UserSettings>(response);
		},
		staleTime: 30_000,
	});

	// Update enabled models
	const updateEnabledModelsMutation = useMutation({
		mutationFn: async (enabledModels: string[]) => {
			const response = await fetch(`${apiBase}/user/settings`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ enabledModels }),
			});
			if (!response.ok) throw new Error("Failed to update enabled models");
			return parseJsonResponse(response);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["user", "settings"] });
		},
		onError: (error) => {
			toast.error((error as Error).message);
		},
	});

	const handleToggleModel = (modelId: string, enabled: boolean) => {
		const currentEnabled = settingsQuery.data?.enabledModels || [];
		const newEnabled = enabled
			? [...currentEnabled, modelId]
			: currentEnabled.filter((id) => id !== modelId);
		updateEnabledModelsMutation.mutate(newEnabled);
	};

	const isLoading = modelsQuery.isLoading || settingsQuery.isLoading;
	const models = modelsQuery.data || [];
	const userApiKeys = settingsQuery.data?.apiKeys || {};
	const enabledModels = settingsQuery.data?.enabledModels || [];

	const freeModels = models.filter((m) => m.access === "free");
	const premiumModels = models.filter((m) => m.access === "byok");

	// Group premium models by provider
	const premiumByProvider = premiumModels.reduce(
		(acc, model) => {
			if (!acc[model.provider]) acc[model.provider] = [];
			acc[model.provider].push(model);
			return acc;
		},
		{} as Record<string, ModelDefinition[]>,
	);

	const formatCost = (cost: { input: number; output: number }) => {
		return `$${cost.input.toFixed(3)}/$${cost.output.toFixed(3)} per 1K tokens`;
	};

	const formatContext = (contextWindow: number) => {
		if (contextWindow >= 1_000_000) {
			return `${(contextWindow / 1_000_000).toFixed(1)}M`;
		}
		return `${(contextWindow / 1000).toFixed(0)}K`;
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
					<CardTitle>Model Management</CardTitle>
					<CardDescription>
						Toggle models to show or hide them in the model selector. Premium
						models require API keys from the Providers page.
					</CardDescription>
				</CardHeader>
			</Card>

			{/* Free Models */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Zap className="h-4 w-4 text-blue-600" />
						<CardTitle>Basic Models</CardTitle>
						<Badge variant="outline" className="text-xs">
							Free to Use
						</Badge>
					</div>
					<CardDescription>
						These models are provided free of charge by the app
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{freeModels.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No free models available
						</p>
					) : (
						freeModels.map((model) => (
							<ModelRow
								key={model.id}
								model={model}
								enabled={enabledModels.includes(model.id)}
								onToggle={(enabled) => handleToggleModel(model.id, enabled)}
								available={true}
								formatCost={formatCost}
								formatContext={formatContext}
							/>
						))
					)}
				</CardContent>
			</Card>

			{/* Premium Models by Provider */}
			{Object.entries(premiumByProvider).map(([provider, providerModels]) => {
				const providerId = providerModels[0].id.split(":")[0];
				const hasApiKey = Boolean(userApiKeys[providerId]);

				return (
					<Card key={provider}>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Crown className="h-4 w-4 text-amber-600" />
								<CardTitle>{provider} Models</CardTitle>
								<Badge
									variant="outline"
									className="border-amber-200 bg-amber-50 text-amber-700 text-xs"
								>
									Premium
								</Badge>
								{!hasApiKey && (
									<Badge variant="destructive" className="text-xs">
										API Key Required
									</Badge>
								)}
							</div>
							<CardDescription>
								{hasApiKey
									? "These models are unlocked and ready to use"
									: "Add your API key in Providers settings to unlock"}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{providerModels.map((model) => (
								<ModelRow
									key={model.id}
									model={model}
									enabled={enabledModels.includes(model.id)}
									onToggle={(enabled) => handleToggleModel(model.id, enabled)}
									available={hasApiKey}
									formatCost={formatCost}
									formatContext={formatContext}
								/>
							))}
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}

function ModelRow({
	model,
	enabled,
	onToggle,
	available,
	formatCost,
	formatContext,
}: {
	model: ModelDefinition;
	enabled: boolean;
	onToggle: (enabled: boolean) => void;
	available: boolean;
	formatCost: (cost: { input: number; output: number }) => string;
	formatContext: (contextWindow: number) => string;
}) {
	return (
		<div
			className={`flex items-start gap-4 rounded-lg border p-4 transition-all ${
				!available ? "opacity-50" : ""
			}`}
		>
			<div className="flex-1 space-y-2">
				<div className="flex items-center gap-2">
					<h3 className="font-semibold">{model.name}</h3>
					<Badge variant="secondary" className="text-xs">
						{model.provider}
					</Badge>
				</div>

				<p className="text-muted-foreground text-sm">{model.description}</p>

				<div className="flex flex-wrap gap-1">
					{model.capabilities.map((capability) => (
						<Badge key={capability} variant="outline" className="text-xs">
							{capability}
						</Badge>
					))}
				</div>

				<div className="text-muted-foreground text-xs">
					Context: {formatContext(model.contextWindow)}
					{model.maxOutputTokens &&
						` • Output: ${formatContext(model.maxOutputTokens)}`}
					{model.costPer1kTokens && (
						<span className="ml-2 text-amber-600">
							• {formatCost(model.costPer1kTokens)}
						</span>
					)}
				</div>

				{!available && (
					<p className="font-medium text-destructive text-xs">
						Requires API key to use
					</p>
				)}
			</div>

			<div className="flex items-center gap-2">
				<Switch
					checked={enabled}
					onCheckedChange={onToggle}
					disabled={!available}
					aria-label={`Toggle ${model.name}`}
				/>
				<span className="text-muted-foreground text-xs">
					{enabled ? "Shown" : "Hidden"}
				</span>
			</div>
		</div>
	);
}
