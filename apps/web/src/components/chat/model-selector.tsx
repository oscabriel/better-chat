import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/web/components/ui/select";
import { useUserSettings } from "@/web/hooks/use-user-settings";
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
}

interface ModelSelectorProps {
	modelId?: string;
	onModelChange?: (modelId: string) => void;
}

export function ModelSelector({ modelId, onModelChange }: ModelSelectorProps) {
	const [open, setOpen] = useState(false);
	const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;

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

	// Use shared settings hook
	const settingsQuery = useUserSettings();

	const models = modelsQuery.data || [];
	const userApiKeys = settingsQuery.data?.apiKeys || {};
	const enabledModels = settingsQuery.data?.enabledModels || [];

	// Filter models to show:
	// 1. All free models (always available)
	// 2. Premium models that are either:
	//    - Enabled by user in settings, OR
	//    - Have no enabled models set yet (show all by default)
	const showAllModels = enabledModels.length === 0;
	const visibleModels = models.filter((model) => {
		if (model.access === "free") return true;
		if (showAllModels) return true;
		return enabledModels.includes(model.id);
	});

	// Group models by access type
	const freeModels = visibleModels.filter((m) => m.access === "free");
	const premiumModels = visibleModels.filter((m) => m.access === "byok");

	// Check if a premium model is available (has API key)
	const isPremiumAvailable = (model: ModelDefinition) => {
		const providerId = model.id.split(":")[0];
		return Boolean(userApiKeys[providerId]);
	};

	return (
		<Select
			value={modelId}
			onValueChange={(v) => onModelChange?.(v)}
			open={open}
			onOpenChange={setOpen}
		>
			<SelectTrigger className="h-9 w-auto">
				<SelectValue placeholder="Select model" />
			</SelectTrigger>
			<SelectContent className="max-h-72">
				{/* Free Models Section */}
				{freeModels.length > 0 && (
					<>
						<div className="px-2 py-1.5 font-semibold text-muted-foreground text-xs">
							Basic Models
						</div>
						{freeModels.map((model) => (
							<SelectItem key={model.id} value={model.id}>
								{model.name}
							</SelectItem>
						))}
					</>
				)}

				{/* Premium Models Section */}
				{premiumModels.length > 0 && (
					<>
						<div className="mt-2 border-t px-2 py-1.5 pt-2 font-semibold text-muted-foreground text-xs">
							Premium Models
						</div>
						{premiumModels.map((model) => {
							const available = isPremiumAvailable(model);
							return (
								<SelectItem
									key={model.id}
									value={model.id}
									disabled={!available}
									title={
										!available
											? `Add your ${model.provider} API key in Settings → Providers`
											: undefined
									}
								>
									<span className={!available ? "opacity-50" : ""}>
										{model.name}
									</span>
								</SelectItem>
							);
						})}
					</>
				)}

				{visibleModels.length === 0 && (
					<div className="px-2 py-4 text-center text-muted-foreground text-sm">
						No models available. Configure models in Settings.
					</div>
				)}
			</SelectContent>
		</Select>
	);
}
