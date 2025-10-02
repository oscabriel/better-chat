import type {
	LanguageModelV2,
	LanguageModelV2CallOptions,
	LanguageModelV2Middleware,
} from "@ai-sdk/provider";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";

/**
 * Logging middleware for tracking model usage and debugging.
 */
export const loggingMiddleware: LanguageModelV2Middleware = {
	wrapGenerate: async ({
		doGenerate,
		params: _params,
	}: {
		doGenerate: () => PromiseLike<
			Awaited<ReturnType<LanguageModelV2["doGenerate"]>>
		>;
		params: LanguageModelV2CallOptions;
	}) => {
		const startTime = Date.now();
		console.log("Model generation started");

		const result = await doGenerate();

		console.log("Model generation completed", {
			duration: Date.now() - startTime,
			usage: result.usage,
		});

		return result;
	},

	wrapStream: async ({
		doStream,
		params: _params,
	}: {
		doStream: () => PromiseLike<
			Awaited<ReturnType<LanguageModelV2["doStream"]>>
		>;
		params: LanguageModelV2CallOptions;
	}) => {
		const startTime = Date.now();
		console.log("Model streaming started");

		const { stream, ...rest } = await doStream();

		const transformStream = new TransformStream({
			flush() {
				console.log("Model streaming completed", {
					duration: Date.now() - startTime,
				});
			},
		});

		return {
			stream: stream.pipeThrough(transformStream),
			...rest,
		};
	},
};

/**
 * Apply standard middleware stack to a model.
 */
export function withStandardMiddleware(
	model: LanguageModelV2,
	options?: {
		temperature?: number;
		maxOutputTokens?: number;
		enableLogging?: boolean;
	},
) {
	const middlewares = [];

	// Add logging if enabled
	if (options?.enableLogging) {
		middlewares.push(loggingMiddleware);
	}

	// Add default settings
	middlewares.push(
		defaultSettingsMiddleware({
			settings: {
				temperature: options?.temperature ?? 0.7,
				maxOutputTokens: options?.maxOutputTokens,
			},
		}),
	);

	return wrapLanguageModel({
		model,
		middleware: middlewares,
	});
}
