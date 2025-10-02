import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenAI, openai } from "@ai-sdk/openai";
import {
	createProviderRegistry,
	customProvider,
	defaultSettingsMiddleware,
	extractReasoningMiddleware,
	wrapLanguageModel,
} from "ai";

export interface ModelDefinition {
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

// Static catalog of all supported models
const STATIC_MODELS: ModelDefinition[] = [
	// Basic (Free) Models
	{
		id: "openai:gpt-4o-mini",
		name: "GPT-4o mini",
		provider: "OpenAI",
		description: "Small, efficient model for quick responses",
		access: "free",
		capabilities: ["text", "tools", "images"],
		contextWindow: 128_000,
		maxOutputTokens: 16_384,
	},
	{
		id: "openai:gpt-4.1-mini",
		name: "GPT 4.1 mini",
		provider: "OpenAI",
		description: "Latest small model with improved capabilities",
		access: "free",
		capabilities: ["text", "tools", "images"],
		contextWindow: 128_000,
		maxOutputTokens: 16_384,
	},
	{
		id: "openai:gpt-4.1-nano",
		name: "GPT 4.1 nano",
		provider: "OpenAI",
		description: "Ultra-fast, minimal latency model",
		access: "free",
		capabilities: ["text", "tools"],
		contextWindow: 64_000,
		maxOutputTokens: 8_192,
	},
	{
		id: "google:gemini-2.5-flash-lite",
		name: "Gemini 2.5 Flash Lite",
		provider: "Google",
		description: "Fast, low-cost model ideal for chat and tools",
		access: "free",
		capabilities: ["text", "tools", "images"],
		contextWindow: 128_000,
		maxOutputTokens: 8_192,
	},
	{
		id: "llama:llama-4-scout-17b-16e",
		name: "Llama 4 Scout 17B 16E",
		provider: "Meta",
		description: "Efficient open model with strong performance",
		access: "free",
		capabilities: ["text", "tools"],
		contextWindow: 128_000,
		maxOutputTokens: 8_192,
	},
	{
		id: "llama:llama-3.1-8b-instant",
		name: "Llama 3.1 8B Instant",
		provider: "Meta",
		description: "Fast, lightweight model for instant responses",
		access: "free",
		capabilities: ["text"],
		contextWindow: 128_000,
		maxOutputTokens: 8_192,
	},
	// Premium (BYOK) Models - OpenAI
	{
		id: "openai:gpt-4o",
		name: "GPT-4o",
		provider: "OpenAI",
		description: "High-performance multimodal model",
		access: "byok",
		capabilities: ["text", "tools", "images"],
		contextWindow: 128_000,
		maxOutputTokens: 16_384,
		costPer1kTokens: { input: 0.005, output: 0.015 },
	},
	{
		id: "openai:o3-mini",
		name: "o3 mini",
		provider: "OpenAI",
		description: "Reasoning-optimized small model",
		access: "byok",
		capabilities: ["text", "tools", "reasoning"],
		contextWindow: 128_000,
		maxOutputTokens: 100_000,
		costPer1kTokens: { input: 0.011, output: 0.044 },
	},
	{
		id: "openai:o4-mini",
		name: "o4 mini",
		provider: "OpenAI",
		description: "Next-gen reasoning model, compact size",
		access: "byok",
		capabilities: ["text", "tools", "reasoning"],
		contextWindow: 128_000,
		maxOutputTokens: 100_000,
		costPer1kTokens: { input: 0.011, output: 0.044 },
	},
	{
		id: "openai:o3",
		name: "o3",
		provider: "OpenAI",
		description: "Advanced reasoning model",
		access: "byok",
		capabilities: ["text", "tools", "reasoning"],
		contextWindow: 200_000,
		maxOutputTokens: 100_000,
		costPer1kTokens: { input: 0.05, output: 0.15 },
	},
	{
		id: "openai:o3-pro",
		name: "o3 pro",
		provider: "OpenAI",
		description: "Professional-grade reasoning model",
		access: "byok",
		capabilities: ["text", "tools", "reasoning"],
		contextWindow: 200_000,
		maxOutputTokens: 100_000,
		costPer1kTokens: { input: 0.1, output: 0.3 },
	},
	{
		id: "openai:gpt-4.1",
		name: "GPT 4.1",
		provider: "OpenAI",
		description: "Latest flagship model with enhanced capabilities",
		access: "byok",
		capabilities: ["text", "tools", "images"],
		contextWindow: 200_000,
		maxOutputTokens: 16_384,
		costPer1kTokens: { input: 0.03, output: 0.06 },
	},
	{
		id: "openai:gpt-5",
		name: "GPT-5",
		provider: "OpenAI",
		description: "Next-generation flagship model",
		access: "byok",
		capabilities: ["text", "tools", "images", "reasoning"],
		contextWindow: 200_000,
		maxOutputTokens: 32_768,
		costPer1kTokens: { input: 0.05, output: 0.1 },
	},
	// Premium (BYOK) Models - Anthropic
	{
		id: "anthropic:claude-opus-4",
		name: "Claude Opus 4",
		provider: "Anthropic",
		description: "Most capable Claude model, for complex tasks",
		access: "byok",
		capabilities: ["text", "tools", "images", "reasoning"],
		contextWindow: 200_000,
		maxOutputTokens: 8_192,
		costPer1kTokens: { input: 0.015, output: 0.075 },
	},
	{
		id: "anthropic:claude-sonnet-4.5",
		name: "Claude Sonnet 4.5",
		provider: "Anthropic",
		description: "Enhanced balanced model with thinking support",
		access: "byok",
		capabilities: ["text", "tools", "images", "reasoning"],
		contextWindow: 200_000,
		maxOutputTokens: 8_192,
		costPer1kTokens: { input: 0.003, output: 0.015 },
	},
	{
		id: "anthropic:claude-sonnet-4",
		name: "Claude Sonnet 4",
		provider: "Anthropic",
		description: "Balanced speed and capability",
		access: "byok",
		capabilities: ["text", "tools", "images", "reasoning"],
		contextWindow: 200_000,
		maxOutputTokens: 8_192,
		costPer1kTokens: { input: 0.003, output: 0.015 },
	},
	{
		id: "anthropic:claude-sonnet-3.7",
		name: "Claude Sonnet 3.7",
		provider: "Anthropic",
		description: "Proven performance with extended thinking",
		access: "byok",
		capabilities: ["text", "tools", "images", "reasoning"],
		contextWindow: 200_000,
		maxOutputTokens: 8_192,
		costPer1kTokens: { input: 0.003, output: 0.015 },
	},
	{
		id: "anthropic:claude-haiku-3.5",
		name: "Claude Haiku 3.5",
		provider: "Anthropic",
		description: "Fast, lightweight model for quick tasks",
		access: "byok",
		capabilities: ["text", "tools", "images"],
		contextWindow: 200_000,
		maxOutputTokens: 8_192,
		costPer1kTokens: { input: 0.0008, output: 0.004 },
	},
	// Premium (BYOK) Models - Google
	{
		id: "google:gemini-2.5-flash",
		name: "Gemini 2.5 Flash",
		provider: "Google",
		description: "Fast, versatile multimodal model",
		access: "byok",
		capabilities: ["text", "tools", "images"],
		contextWindow: 1_000_000,
		maxOutputTokens: 8_192,
		costPer1kTokens: { input: 0.001, output: 0.003 },
	},
	{
		id: "google:gemini-2.5-pro",
		name: "Gemini 2.5 Pro",
		provider: "Google",
		description: "Advanced model with million-token context",
		access: "byok",
		capabilities: ["text", "tools", "images", "reasoning"],
		contextWindow: 2_000_000,
		maxOutputTokens: 8_192,
		costPer1kTokens: { input: 0.003, output: 0.01 },
	},
	// Premium (BYOK) Models - Meta Llama
	{
		id: "llama:llama-4-maverick-17b-128e-instant",
		name: "Llama 4 Maverick 17B 128E Instant",
		provider: "Meta",
		description: "Powerful open model with extended training",
		access: "byok",
		capabilities: ["text", "tools", "reasoning"],
		contextWindow: 128_000,
		maxOutputTokens: 8_192,
		costPer1kTokens: { input: 0.002, output: 0.006 },
	},
];

const FREE_MODEL_IDS = new Set(
	STATIC_MODELS.filter((m) => m.access === "free").map((m) => m.id),
);

interface ModelsDevRecord {
	provider: { id: string; name: string };
	model: { id: string; name: string; description?: string };
	pricing: {
		input_cost_per_million_tokens?: number;
		output_cost_per_million_tokens?: number;
	};
	capabilities: {
		tool_call?: boolean;
		reasoning?: boolean;
		multimodal?: boolean;
	};
	context_limit?: number;
	output_limit?: number;
}

let modelsDevCache: ModelDefinition[] | null = null;

export async function loadModelsDevCatalog(
	force = false,
): Promise<ModelDefinition[]> {
	if (!force && modelsDevCache) return modelsDevCache ?? STATIC_MODELS;
	// Replace remote fetch with static list for now
	modelsDevCache = STATIC_MODELS;
	return modelsDevCache;
}

function _mapModelsDevRecord(entry: ModelsDevRecord): ModelDefinition | null {
	if (!entry?.provider?.id || !entry?.model?.id) return null;

	const id = `${entry.provider.id}:${entry.model.id}`;
	const access = FREE_MODEL_IDS.has(id) ? "free" : "byok";

	return {
		id,
		name: entry.model.name,
		provider: entry.provider.name,
		description: entry.model.description ?? "",
		access,
		capabilities: deriveCapabilities(entry),
		contextWindow: entry.context_limit ?? 128000,
		maxOutputTokens: entry.output_limit,
		costPer1kTokens: normalizePricing(entry.pricing),
	};
}

function deriveCapabilities(entry: ModelsDevRecord): string[] {
	const caps: string[] = ["text"];
	if (entry.capabilities?.tool_call) caps.push("tools");
	if (entry.capabilities?.reasoning) caps.push("reasoning");
	if (entry.capabilities?.multimodal) caps.push("images");
	return caps;
}

function normalizePricing(pricing: ModelsDevRecord["pricing"]) {
	if (
		!pricing?.input_cost_per_million_tokens ||
		!pricing?.output_cost_per_million_tokens
	)
		return undefined;
	return {
		input: pricing.input_cost_per_million_tokens / 1000,
		output: pricing.output_cost_per_million_tokens / 1000,
	};
}

// Configure global default provider for free tier simplification
if (process.env.NODE_ENV === "production") {
	globalThis.AI_SDK_DEFAULT_PROVIDER = google;
}

// Create Llama provider (uses OpenAI-compatible API)
const llama = createOpenAI({
	baseURL: "https://api.llama-api.com/v1",
	apiKey: process.env.LLAMA_API_KEY || "",
});

export const registry = createProviderRegistry({
	openai,
	anthropic,
	google: customProvider({
		languageModels: {
			"gemini-2.5-flash-lite": google("gemini-2.5-flash-lite"),
			"gemini-2.5-flash": google("gemini-2.5-flash"),
			"gemini-2.5-pro": google("gemini-2.5-pro"),
		},
		fallbackProvider: google,
	}),
	llama: customProvider({
		languageModels: {
			"llama-4-scout-17b-16e": llama("llama-4-scout-17b-16e"),
			"llama-3.1-8b-instant": llama("llama-3.1-8b-instant"),
			"llama-4-maverick-17b-128e-instant": llama(
				"llama-4-maverick-17b-128e-instant",
			),
		},
		fallbackProvider: llama,
	}),
});

/**
 * Get model instance with optional user API key for BYOK support.
 * Creates dynamic provider instances when user API keys are provided.
 */
export function getModelFromId(modelId: string, userApiKey?: string) {
	const [provider, model] = modelId.split(":");

	// For BYOK: Create provider instance with user's API key
	if (userApiKey) {
		switch (provider) {
			case "openai":
				return createOpenAI({ apiKey: userApiKey })(model);
			case "anthropic":
				return createAnthropic({ apiKey: userApiKey })(model);
			case "google": {
				const customGoogle = createOpenAI({
					baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
					apiKey: userApiKey,
				});
				return customGoogle(model);
			}
			case "llama":
				return createOpenAI({
					baseURL: "https://api.llama-api.com/v1",
					apiKey: userApiKey,
				})(model);
		}
	}

	// Use registry for free tier models
	// biome-ignore lint/suspicious/noExplicitAny: Registry requires specific literal types but accepts any valid provider:model string at runtime
	return registry.languageModel(`${provider}:${model}` as any);
}

/**
 * Get model with reasoning middleware for models that support extended thinking.
 * Applies reasoning extraction and provider-specific configuration.
 */
export function getReasoningModel(modelId: string, userApiKey?: string) {
	const baseModel = getModelFromId(modelId, userApiKey);
	const [provider, model] = modelId.split(":");

	// Configure provider-specific reasoning options
	if (provider === "openai" && model.startsWith("o")) {
		// OpenAI o1/o3 models
		return wrapLanguageModel({
			model: baseModel,
			middleware: defaultSettingsMiddleware({
				settings: {
					providerOptions: {
						openai: {
							reasoningEffort: "medium", // 'low' | 'medium' | 'high'
						},
					},
				},
			}),
		});
	}

	if (provider === "anthropic" && model.includes("sonnet")) {
		// Anthropic Claude with thinking
		return wrapLanguageModel({
			model: baseModel,
			middleware: defaultSettingsMiddleware({
				settings: {
					providerOptions: {
						anthropic: {
							thinking: {
								type: "enabled",
								budgetTokens: 32000,
							},
						},
					},
				},
			}),
		});
	}

	if (provider === "deepseek" && model.includes("r1")) {
		// DeepSeek R1 with reasoning extraction
		return wrapLanguageModel({
			model: baseModel,
			middleware: [
				extractReasoningMiddleware({ tagName: "think" }),
				defaultSettingsMiddleware({
					settings: {
						temperature: 0.7,
					},
				}),
			],
		});
	}

	return baseModel;
}

export async function getModelDefinition(
	modelId: string,
): Promise<ModelDefinition | null> {
	const catalog = await loadModelsDevCatalog();
	return catalog.find((model) => model.id === modelId) ?? null;
}

export async function getFreeModels(): Promise<ModelDefinition[]> {
	const catalog = await loadModelsDevCatalog();
	return catalog.filter((model) => model.access === "free");
}

export async function getBYOKModels(): Promise<ModelDefinition[]> {
	const catalog = await loadModelsDevCatalog();
	return catalog.filter((model) => model.access === "byok");
}

export async function getUserAvailableModels(
	userApiKeys: Record<string, string>,
): Promise<ModelDefinition[]> {
	const catalog = await loadModelsDevCatalog();

	return catalog.filter((model) => {
		if (model.access === "free") return true;
		const provider = model.id.split(":")[0];
		return Boolean(userApiKeys[provider]);
	});
}

export async function validateModelAccess(
	modelId: string,
	userApiKeys: Record<string, string>,
): Promise<boolean> {
	const model = await getModelDefinition(modelId);
	if (!model) return false;

	if (model.access === "byok") {
		const provider = modelId.split(":")[0];
		return !!userApiKeys[provider];
	}

	return true;
}

export async function requiresAPIKey(modelId: string): Promise<boolean> {
	const model = await getModelDefinition(modelId);
	return model?.access === "byok" || false;
}

/**
 * Get the display name for a model ID
 * Returns the pretty name if found, otherwise returns the ID as-is
 */
export function getModelDisplayName(modelId: string): string {
	const model = STATIC_MODELS.find((m) => m.id === modelId);
	return model?.name ?? modelId;
}
