import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Loader2, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/web/components/ui/card";
import { Progress } from "@/web/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/web/components/ui/tooltip";
import { parseJsonResponse } from "@/web/utils/chat";
import { onSyncEvent } from "@/web/utils/sync";

interface UsageData {
	daily: {
		used: number;
		limit: number;
		remaining: number;
	};
	monthly: {
		used: number;
		limit: number;
		remaining: number;
	};
}

interface UsageStats {
	daily: Array<{
		date: string;
		messages: number;
		tokens: {
			input: number;
			output: number;
			total: number;
		};
		models: Record<
			string,
			{
				messages: number;
				inputTokens: number;
				outputTokens: number;
			}
		>;
	}>;
	totals: {
		messages: number;
		tokens: {
			input: number;
			output: number;
			total: number;
		};
		models: Record<
			string,
			{
				messages: number;
				inputTokens: number;
				outputTokens: number;
			}
		>;
	};
}

interface ModelDefinition {
	id: string;
	name: string;
	provider: string;
}

// Format large numbers with K/M suffix
function formatTokenCount(count: number): string {
	if (count >= 1_000_000) {
		return `${(count / 1_000_000).toFixed(2)}M`;
	}
	if (count >= 1_000) {
		return `${(count / 1_000).toFixed(2)}K`;
	}
	return count.toLocaleString();
}

export const Route = createFileRoute("/settings/usage")({
	component: UsageSettings,
});

function UsageSettings() {
	const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;
	const queryClient = useQueryClient();
	const [period, setPeriod] = useState<"day" | "week" | "month">("month");

	// Fetch model catalog for display names
	const modelsQuery = useQuery<ModelDefinition[]>({
		queryKey: ["models", "all"],
		queryFn: async () => {
			const response = await fetch(`${apiBase}/models/all`, {
				credentials: "include",
			});
			return parseJsonResponse<ModelDefinition[]>(response);
		},
		staleTime: 60_000 * 5, // 5 minutes
	});

	// Fetch current usage limits
	const usageQuery = useQuery<UsageData>({
		queryKey: ["usage", "current"],
		queryFn: async () => {
			const response = await fetch(`${apiBase}/usage/current`, {
				credentials: "include",
			});
			return parseJsonResponse<UsageData>(response);
		},
		staleTime: 30_000,
	});

	// Fetch usage statistics
	const endDate = new Date().toISOString().split("T")[0];
	const startDate = useMemo(() => {
		const date = new Date();
		if (period === "day") {
			// Today only
			return date.toISOString().split("T")[0];
		}
		if (period === "week") {
			date.setDate(date.getDate() - 7);
		} else {
			date.setDate(1); // First day of current month
		}
		return date.toISOString().split("T")[0];
	}, [period]);

	const statsQuery = useQuery<UsageStats>({
		queryKey: ["usage", "stats", startDate, endDate],
		queryFn: async () => {
			const response = await fetch(
				`${apiBase}/usage/stats?startDate=${startDate}&endDate=${endDate}`,
				{
					credentials: "include",
				},
			);
			return parseJsonResponse<UsageStats>(response);
		},
		staleTime: 30_000,
	});

	// Listen for cross-tab sync events to update usage in real-time
	useEffect(() => {
		const cleanup = onSyncEvent((event) => {
			if (event.type === "usage-changed") {
				// Invalidate both usage queries when usage changes in another tab
				queryClient.invalidateQueries({ queryKey: ["usage", "current"] });
				queryClient.invalidateQueries({ queryKey: ["usage", "stats"] });
			}
		});

		return () => {
			cleanup?.();
		};
	}, [queryClient]);

	// Helper to get display name for a model ID
	const getModelDisplayName = (modelId: string): string => {
		const model = modelsQuery.data?.find((m) => m.id === modelId);
		return model?.name ?? modelId;
	};

	const isLoading = usageQuery.isLoading || statsQuery.isLoading;

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const usage = usageQuery.data;
	const stats = statsQuery.data;

	const dailyPercentage = usage
		? (usage.daily.used / usage.daily.limit) * 100
		: 0;
	const monthlyPercentage = usage
		? (usage.monthly.used / usage.monthly.limit) * 100
		: 0;

	const totalMessages = stats?.totals?.messages ?? 0;
	const totalInputTokens = stats?.totals?.tokens?.input ?? 0;
	const totalOutputTokens = stats?.totals?.tokens?.output ?? 0;
	const totalTokens = stats?.totals?.tokens?.total ?? 0;

	const modelEntries = stats?.totals?.models
		? Object.entries(stats.totals.models).sort(
				([, a], [, b]) => b.messages - a.messages,
			)
		: [];

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Usage & Limits</CardTitle>
							<CardDescription>
								Track your message and token usage across all conversations.
								Free users have default limits; BYOK users have unlimited usage.
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Daily Usage */}
					<div>
						<div className="mb-2 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Calendar className="h-4 w-4 text-muted-foreground" />
								<span className="font-medium text-sm">Today's Messages</span>
							</div>
							<span className="text-muted-foreground text-sm">
								{usage?.daily.used || 0} / {usage?.daily.limit || 0}
							</span>
						</div>
						<Progress value={dailyPercentage} className="h-2" />
						<p className="mt-1 text-muted-foreground text-xs">
							{usage?.daily.remaining || 0} messages remaining today
						</p>
					</div>

					{/* Monthly Usage */}
					<div>
						<div className="mb-2 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<TrendingUp className="h-4 w-4 text-muted-foreground" />
								<span className="font-medium text-sm">
									This Month's Messages
								</span>
							</div>
							<span className="text-muted-foreground text-sm">
								{usage?.monthly.used || 0} / {usage?.monthly.limit || 0}
							</span>
						</div>
						<Progress value={monthlyPercentage} className="h-2" />
						<p className="mt-1 text-muted-foreground text-xs">
							{usage?.monthly.remaining || 0} messages remaining this month
						</p>
					</div>

					{/* Daily limit warnings */}
					{dailyPercentage >= 100 ? (
						<div className="rounded-lg border border-red-200 bg-red-50 p-3">
							<p className="font-medium text-red-900 text-sm">
								🚫 Daily limit reached
							</p>
							<p className="mt-1 text-red-800 text-xs">
								You've used all your free messages for today. Add your own API
								key in{" "}
								<a
									href="/settings/providers"
									className="underline hover:text-red-900"
								>
									Provider Settings
								</a>{" "}
								for unlimited usage, or try again tomorrow.
							</p>
						</div>
					) : dailyPercentage >= 80 ? (
						<div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
							<p className="text-amber-800 text-sm">
								⚠️ You're approaching your daily limit. Add your own API key in{" "}
								<a
									href="/settings/providers"
									className="underline hover:text-amber-900"
								>
									Provider Settings
								</a>{" "}
								for unlimited usage.
							</p>
						</div>
					) : null}

					{/* Monthly limit warnings */}
					{monthlyPercentage >= 100 ? (
						<div className="rounded-lg border border-red-200 bg-red-50 p-3">
							<p className="font-medium text-red-900 text-sm">
								🚫 Monthly limit reached
							</p>
							<p className="mt-1 text-red-800 text-xs">
								You've used all your free messages for this month. Add your own
								API key in{" "}
								<a
									href="/settings/providers"
									className="underline hover:text-red-900"
								>
									Provider Settings
								</a>{" "}
								for unlimited usage. Your free quota will reset on the 1st of
								next month.
							</p>
						</div>
					) : monthlyPercentage >= 80 ? (
						<div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
							<p className="text-amber-800 text-sm">
								⚠️ You're approaching your monthly limit. Add your own API key in{" "}
								<a
									href="/settings/providers"
									className="underline hover:text-amber-900"
								>
									Provider Settings
								</a>{" "}
								for unlimited usage.
							</p>
						</div>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Usage Statistics</CardTitle>
							<CardDescription>
								Detailed breakdown of your activity
							</CardDescription>
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setPeriod("day")}
								className={`rounded-md px-3 py-1 text-sm ${
									period === "day"
										? "bg-primary text-primary-foreground"
										: "bg-muted"
								}`}
							>
								Day
							</button>
							<button
								type="button"
								onClick={() => setPeriod("week")}
								className={`rounded-md px-3 py-1 text-sm ${
									period === "week"
										? "bg-primary text-primary-foreground"
										: "bg-muted"
								}`}
							>
								Week
							</button>
							<button
								type="button"
								onClick={() => setPeriod("month")}
								className={`rounded-md px-3 py-1 text-sm ${
									period === "month"
										? "bg-primary text-primary-foreground"
										: "bg-muted"
								}`}
							>
								Month
							</button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					<TooltipProvider>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<div className="rounded-lg border bg-background/60 p-4">
								<p className="text-muted-foreground text-xs uppercase tracking-wide">
									Total Messages
								</p>
								<p className="mt-1 font-semibold text-2xl">
									{totalMessages.toLocaleString()}
								</p>
							</div>
							<div className="rounded-lg border bg-background/60 p-4">
								<p className="text-muted-foreground text-xs uppercase tracking-wide">
									Input Tokens
								</p>
								<Tooltip>
									<TooltipTrigger asChild>
										<p className="mt-1 cursor-help font-semibold text-2xl">
											{formatTokenCount(totalInputTokens)}
										</p>
									</TooltipTrigger>
									<TooltipContent>
										<p>{totalInputTokens.toLocaleString()} tokens</p>
									</TooltipContent>
								</Tooltip>
							</div>
							<div className="rounded-lg border bg-background/60 p-4">
								<p className="text-muted-foreground text-xs uppercase tracking-wide">
									Output Tokens
								</p>
								<Tooltip>
									<TooltipTrigger asChild>
										<p className="mt-1 cursor-help font-semibold text-2xl">
											{formatTokenCount(totalOutputTokens)}
										</p>
									</TooltipTrigger>
									<TooltipContent>
										<p>{totalOutputTokens.toLocaleString()} tokens</p>
									</TooltipContent>
								</Tooltip>
							</div>
							<div className="rounded-lg border bg-background/60 p-4">
								<p className="text-muted-foreground text-xs uppercase tracking-wide">
									Total Tokens
								</p>
								<Tooltip>
									<TooltipTrigger asChild>
										<p className="mt-1 cursor-help font-semibold text-2xl">
											{formatTokenCount(totalTokens)}
										</p>
									</TooltipTrigger>
									<TooltipContent>
										<p>{totalTokens.toLocaleString()} tokens</p>
									</TooltipContent>
								</Tooltip>
							</div>
						</div>
					</TooltipProvider>

					{modelEntries.length > 0 && (
						<div>
							<h3 className="mb-3 font-medium text-sm">Model Breakdown</h3>
							<div className="space-y-3">
								{modelEntries.map(([modelId, entry]) => {
									const percentage = totalMessages
										? (entry.messages / totalMessages) * 100
										: 0;
									return (
										<div
											key={modelId}
											className="rounded-lg border bg-background/60 p-4"
										>
											<div className="flex items-center justify-between text-sm">
												<span className="font-medium">
													{getModelDisplayName(modelId)}
												</span>
												<span className="text-muted-foreground">
													{entry.messages.toLocaleString()} messages
												</span>
											</div>
											<Progress value={percentage} className="mt-2 h-1" />
											<div className="mt-3 grid gap-2 sm:grid-cols-3">
												<div>
													<p className="text-muted-foreground text-xs uppercase tracking-wide">
														Input Tokens
													</p>
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<p className="cursor-help font-medium text-sm">
																	{formatTokenCount(entry.inputTokens)}
																</p>
															</TooltipTrigger>
															<TooltipContent>
																<p>
																	{entry.inputTokens.toLocaleString()} tokens
																</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												</div>
												<div>
													<p className="text-muted-foreground text-xs uppercase tracking-wide">
														Output Tokens
													</p>
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<p className="cursor-help font-medium text-sm">
																	{formatTokenCount(entry.outputTokens)}
																</p>
															</TooltipTrigger>
															<TooltipContent>
																<p>
																	{entry.outputTokens.toLocaleString()} tokens
																</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												</div>
												<div>
													<p className="text-muted-foreground text-xs uppercase tracking-wide">
														Total Tokens
													</p>
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<p className="cursor-help font-medium text-sm">
																	{formatTokenCount(
																		entry.inputTokens + entry.outputTokens,
																	)}
																</p>
															</TooltipTrigger>
															<TooltipContent>
																<p>
																	{(
																		entry.inputTokens + entry.outputTokens
																	).toLocaleString()}{" "}
																	tokens
																</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Need More?</CardTitle>
					<CardDescription>
						Add your own API keys for unlimited usage with no rate limits
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground text-sm">
						Want to remove all usage limits? Add your own API key from one or
						more supported providers to get unlimited access. You'll only pay
						for what you use directly through the provider.
					</p>
					<div className="space-y-3">
						<div className="rounded-lg border bg-background/60 p-4">
							<h4 className="mb-2 font-medium">Supported Providers</h4>
							<ul className="space-y-1 text-muted-foreground text-sm">
								<li>• OpenAI, Anthropic, Google, Meta</li>
							</ul>
						</div>
						<a
							href="/settings/providers"
							className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
						>
							Configure API Keys
						</a>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
