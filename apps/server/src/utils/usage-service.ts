import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { usageEvents } from "@/server/db/schema/usage";
import {
	DEFAULT_DAILY_MESSAGE_LIMIT,
	DEFAULT_MONTHLY_MESSAGE_LIMIT,
} from "@/server/lib/constants";

type UsageRecord = typeof usageEvents.$inferSelect;

type ModelUsageEntry = {
	messages: number;
	inputTokens: number;
	outputTokens: number;
};

export class QuotaExceededError extends Error {
	constructor(readonly limitType: "daily" | "monthly") {
		super(
			limitType === "daily"
				? "Daily message limit reached"
				: "Monthly message limit reached",
		);
		this.name = "QuotaExceededError";
	}
}

function parseModelUsage(value: unknown): Record<string, ModelUsageEntry> {
	if (value == null) return {};

	let raw: unknown = value;
	if (typeof value === "string" && value.length > 0) {
		try {
			raw = JSON.parse(value);
		} catch (error) {
			console.error("failed to parse model usage json", { value, error });
			return {};
		}
	}

	if (!raw || typeof raw !== "object") {
		return {};
	}

	const result: Record<string, ModelUsageEntry> = {};
	for (const [modelId, entry] of Object.entries(
		raw as Record<string, unknown>,
	)) {
		if (entry && typeof entry === "object") {
			const messages = Number((entry as { messages?: unknown }).messages ?? 0);
			const inputTokens = Number(
				(entry as { inputTokens?: unknown }).inputTokens ?? 0,
			);
			const outputTokens = Number(
				(entry as { outputTokens?: unknown }).outputTokens ?? 0,
			);

			result[modelId] = {
				messages: Number.isFinite(messages) ? messages : 0,
				inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
				outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
			};
		} else {
			const numericValue = Number(entry);
			result[modelId] = {
				messages: Number.isFinite(numericValue) ? numericValue : 0,
				inputTokens: 0,
				outputTokens: 0,
			};
		}
	}

	return result;
}

function serializeModelUsage(entries: Record<string, ModelUsageEntry>): string {
	return JSON.stringify(entries);
}

function createUsageId(userId: string, daysSinceEpoch: number) {
	return `${userId}:${daysSinceEpoch}`;
}

function getDaysSinceEpoch(date: Date = new Date()): number {
	return Math.floor(date.getTime() / 86400000); // 86400000ms = 1 day
}

function dateFromDaysSinceEpoch(days: number): Date {
	return new Date(days * 86400000);
}

async function getDailyUsage(
	userId: string,
	daysSinceEpoch: number,
): Promise<UsageRecord | null> {
	const result = await db
		.select()
		.from(usageEvents)
		.where(
			and(
				eq(usageEvents.userId, userId),
				eq(usageEvents.daysSinceEpoch, daysSinceEpoch),
			),
		)
		.get();
	return result ?? null;
}

async function ensureDailyUsage(
	userId: string,
	daysSinceEpoch: number,
): Promise<UsageRecord> {
	const existing = await getDailyUsage(userId, daysSinceEpoch);
	if (existing) return existing;

	const now = new Date();
	const record: UsageRecord = {
		id: createUsageId(userId, daysSinceEpoch),
		userId,
		daysSinceEpoch,
		messagesCount: 0,
		modelUsage: "{}",
		lastMessageAt: null,
		createdAt: now,
		updatedAt: now,
	};

	await db.insert(usageEvents).values(record).onConflictDoNothing();
	return (await getDailyUsage(userId, daysSinceEpoch)) ?? record;
}

/**
 * Check if user has available quota for a provider.
 * If user has BYOK (their own API key) for this provider, they have unlimited quota.
 * Otherwise, check against default limits.
 */
export async function requireAvailableQuota(
	userId: string,
	provider: string,
	userApiKeys: Record<string, string>,
) {
	// If user has their own API key for this provider, no quota limits apply
	if (userApiKeys[provider]) {
		return; // Unlimited usage with BYOK
	}

	// For non-BYOK users, check against default limits
	const summary = await getCurrentUsageSummary(userId);
	if (!summary.daily.allowed) {
		throw new QuotaExceededError("daily");
	}
	if (!summary.monthly.allowed) {
		throw new QuotaExceededError("monthly");
	}
}

export async function recordUsage(
	userId: string,
	params: {
		modelId: string;
		usage?: {
			inputTokens?: number;
			outputTokens?: number;
			totalTokens?: number;
		};
		cost?: number;
		conversationId: string;
	},
) {
	console.log("[RECORD USAGE] Called with:", {
		userId,
		modelId: params.modelId,
		usage: params.usage,
		cost: params.cost,
		conversationId: params.conversationId,
	});

	const now = new Date();
	const today = getDaysSinceEpoch(now);
	const inputTokens = params.usage?.inputTokens ?? 0;
	const outputTokens = params.usage?.outputTokens ?? 0;

	console.log(
		"[RECORD USAGE] Extracted tokens - input:",
		inputTokens,
		"output:",
		outputTokens,
	);

	const existing = await ensureDailyUsage(userId, today);
	const modelUsage = parseModelUsage(existing.modelUsage);
	const current = modelUsage[params.modelId] ?? {
		messages: 0,
		inputTokens: 0,
		outputTokens: 0,
	};

	modelUsage[params.modelId] = {
		messages: current.messages + 1,
		inputTokens: current.inputTokens + inputTokens,
		outputTokens: current.outputTokens + outputTokens,
	};

	const updateResult = await db
		.update(usageEvents)
		.set({
			messagesCount: (existing.messagesCount ?? 0) + 1,
			modelUsage: serializeModelUsage(modelUsage),
			lastMessageAt: now,
			updatedAt: now,
		})
		.where(eq(usageEvents.id, createUsageId(userId, today)));

	console.log("[RECORD USAGE] D1 update complete. Result:", updateResult);
}

/**
 * Get current usage summary with default quota limits.
 * Note: Users with BYOK have unlimited quota and should check userApiKeys separately.
 */
export async function getCurrentUsageSummary(userId: string) {
	const now = new Date();
	const today = getDaysSinceEpoch(now);
	const todayUsage = await getDailyUsage(userId, today);
	const dailyUsed = todayUsage?.messagesCount ?? 0;

	// Calculate start of current month in days since epoch
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const monthStartDay = getDaysSinceEpoch(startOfMonth);

	const monthlyRecords = await db
		.select({ messagesCount: usageEvents.messagesCount })
		.from(usageEvents)
		.where(
			and(
				eq(usageEvents.userId, userId),
				gte(usageEvents.daysSinceEpoch, monthStartDay),
			),
		)
		.all();

	const monthlyUsed = monthlyRecords.reduce(
		(sum, record) => sum + (record.messagesCount ?? 0),
		0,
	);

	const dailyLimit = DEFAULT_DAILY_MESSAGE_LIMIT;
	const monthlyLimit = DEFAULT_MONTHLY_MESSAGE_LIMIT;

	return {
		daily: {
			used: dailyUsed,
			limit: dailyLimit,
			remaining: Math.max(dailyLimit - dailyUsed, 0),
			allowed: dailyUsed < dailyLimit,
		},
		monthly: {
			used: monthlyUsed,
			limit: monthlyLimit,
			remaining: Math.max(monthlyLimit - monthlyUsed, 0),
			allowed: monthlyUsed < monthlyLimit,
		},
	};
}

export async function getUsageStats(
	userId: string,
	startDate?: string,
	endDate?: string,
) {
	const conditions = [eq(usageEvents.userId, userId)];

	// Convert ISO date strings to daysSinceEpoch if provided
	if (startDate) {
		const startDay = getDaysSinceEpoch(new Date(startDate));
		conditions.push(gte(usageEvents.daysSinceEpoch, startDay));
	}

	if (endDate) {
		const endDay = getDaysSinceEpoch(new Date(endDate));
		conditions.push(lte(usageEvents.daysSinceEpoch, endDay));
	}

	const records = await db
		.select()
		.from(usageEvents)
		.where(and(...conditions))
		.orderBy(desc(usageEvents.daysSinceEpoch))
		.all();

	const daily = records.map((record) => {
		const modelUsage = parseModelUsage(record.modelUsage);
		const tokenTotals = Object.values(modelUsage).reduce(
			(acc, entry) => {
				acc.input += entry.inputTokens;
				acc.output += entry.outputTokens;
				return acc;
			},
			{ input: 0, output: 0 },
		);

		// Convert daysSinceEpoch back to ISO date string for API response
		const date = dateFromDaysSinceEpoch(record.daysSinceEpoch)
			.toISOString()
			.split("T")[0];

		return {
			date,
			messages: record.messagesCount ?? 0,
			tokens: {
				input: tokenTotals.input,
				output: tokenTotals.output,
				total: tokenTotals.input + tokenTotals.output,
			},
			models: modelUsage,
		};
	});

	const totals = records.reduce(
		(acc, record) => {
			acc.messages += record.messagesCount ?? 0;
			const modelUsage = parseModelUsage(record.modelUsage);
			for (const entry of Object.values(modelUsage)) {
				acc.tokens.input += entry.inputTokens;
				acc.tokens.output += entry.outputTokens;
			}
			return acc;
		},
		{ messages: 0, tokens: { input: 0, output: 0, total: 0 } },
	);

	const modelTotals: Record<string, ModelUsageEntry> = {};
	for (const record of records) {
		const modelUsage = parseModelUsage(record.modelUsage);
		for (const [modelId, entry] of Object.entries(modelUsage)) {
			const aggregate = modelTotals[modelId] || {
				messages: 0,
				inputTokens: 0,
				outputTokens: 0,
			};
			aggregate.messages += entry.messages;
			aggregate.inputTokens += entry.inputTokens;
			aggregate.outputTokens += entry.outputTokens;
			modelTotals[modelId] = aggregate;
		}
	}

	totals.tokens.total = totals.tokens.input + totals.tokens.output;

	return {
		daily,
		totals: {
			messages: totals.messages,
			tokens: totals.tokens,
			models: modelTotals,
		},
	};
}
