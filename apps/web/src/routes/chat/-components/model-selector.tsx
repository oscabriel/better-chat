import { useQuery } from "@tanstack/react-query";
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

const DEFAULT_MODEL_ID = "google:gemini-2.5-flash-lite";

export function ModelSelector({ modelId, onModelChange }: ModelSelectorProps) {
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

	const modelsWithAvailability = models.map((model) => {
		const providerKey = model.id.split(":")[0] || model.provider.toLowerCase();
		const hasProviderKey = Boolean(userApiKeys[providerKey]);
		const isAvailable = model.access === "free" || hasProviderKey;
		return {
			...model,
			providerKey,
			isAvailable,
		};
	});

	const freeModels = modelsWithAvailability.filter(
		(model) => model.access === "free",
	);
	const byokModels = modelsWithAvailability.filter(
		(model) => model.access === "byok",
	);

	const isLoading = modelsQuery.isLoading || settingsQuery.isLoading;
	const hasAnyModels = modelsWithAvailability.length > 0;
	const effectiveValue = modelId ?? DEFAULT_MODEL_ID;
	const selectedModelDef = modelsWithAvailability.find(
		(model) => model.id === effectiveValue,
	);

	return (
		<Select
			value={selectedModelDef ? selectedModelDef.id : effectiveValue}
			onValueChange={(value) => onModelChange?.(value)}
			disabled={isLoading || !hasAnyModels}
		>
			<SelectTrigger className="h-9 w-auto">
				<SelectValue
					placeholder={isLoading ? "Loading models..." : "Select a model"}
				/>
			</SelectTrigger>
			<SelectContent className="max-h-72">
				{isLoading ? (
					<div className="px-2 py-4 text-center text-muted-foreground text-sm">
						Loading models...
					</div>
				) : !hasAnyModels ? (
					<div className="px-2 py-4 text-center text-muted-foreground text-sm">
						No models available. Configure providers in Settings.
					</div>
				) : (
					<>
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

						{byokModels.length > 0 && (
							<>
								<div className="mt-2 border-t px-2 py-1.5 pt-2 font-semibold text-muted-foreground text-xs">
									BYOK Models
								</div>
								{byokModels.map((model) => (
									<SelectItem
										key={model.id}
										value={model.id}
										disabled={!model.isAvailable}
										title={
											model.isAvailable
												? undefined
												: `Add your ${model.provider} API key in Settings → Providers`
										}
									>
										<span className={!model.isAvailable ? "opacity-50" : ""}>
											{model.name}
										</span>
									</SelectItem>
								))}
							</>
						)}
					</>
				)}
			</SelectContent>
		</Select>
	);
}
