import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Loader2, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/web/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/web/components/ui/card";
import { Progress } from "@/web/components/ui/progress";
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

export const Route = createFileRoute("/settings/usage")({
	component: UsageSettings,
});

function UsageSettings() {
	const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;
	const queryClient = useQueryClient();
	const [period, setPeriod] = useState<"week" | "month">("month");

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

					{dailyPercentage >= 80 && (
						<div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
							<p className="text-amber-800 text-sm">
								⚠️ You're approaching your daily limit. Consider upgrading for
								higher quotas.
							</p>
						</div>
					)}

					{monthlyPercentage >= 80 && (
						<div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
							<p className="text-amber-800 text-sm">
								⚠️ You're approaching your monthly limit. Your usage will reset
								on the 1st of next month.
							</p>
						</div>
					)}
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
							<p className="mt-1 font-semibold text-2xl">
								{totalInputTokens.toLocaleString()}
							</p>
						</div>
						<div className="rounded-lg border bg-background/60 p-4">
							<p className="text-muted-foreground text-xs uppercase tracking-wide">
								Output Tokens
							</p>
							<p className="mt-1 font-semibold text-2xl">
								{totalOutputTokens.toLocaleString()}
							</p>
						</div>
						<div className="rounded-lg border bg-background/60 p-4">
							<p className="text-muted-foreground text-xs uppercase tracking-wide">
								Total Tokens
							</p>
							<p className="mt-1 font-semibold text-2xl">
								{totalTokens.toLocaleString()}
							</p>
						</div>
					</div>

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
												<span className="font-medium">{modelId}</span>
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
													<p className="font-medium text-sm">
														{entry.inputTokens.toLocaleString()}
													</p>
												</div>
												<div>
													<p className="text-muted-foreground text-xs uppercase tracking-wide">
														Output Tokens
													</p>
													<p className="font-medium text-sm">
														{entry.outputTokens.toLocaleString()}
													</p>
												</div>
												<div>
													<p className="text-muted-foreground text-xs uppercase tracking-wide">
														Total Tokens
													</p>
													<p className="font-medium text-sm">
														{(
															entry.inputTokens + entry.outputTokens
														).toLocaleString()}
													</p>
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
						Upgrade your plan for higher limits and additional features
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="rounded-lg border bg-background/60 p-4">
						<div className="flex items-center justify-between">
							<div>
								<h4 className="font-medium">Pro Plan</h4>
								<p className="text-muted-foreground text-sm">
									500 messages/day • 10,000 messages/month
								</p>
							</div>
							<Badge>Coming Soon</Badge>
						</div>
					</div>
					<div className="rounded-lg border bg-background/60 p-4">
						<div className="flex items-center justify-between">
							<div>
								<h4 className="font-medium">Unlimited Plan</h4>
								<p className="text-muted-foreground text-sm">
									Unlimited messages • Priority support
								</p>
							</div>
							<Badge>Coming Soon</Badge>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
