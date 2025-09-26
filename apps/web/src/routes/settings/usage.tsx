import { createFileRoute } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/web/components/ui/card";
import { Progress } from "@/web/components/ui/progress";

const usageBreakdown = [
	{ label: "Completions", value: 62, units: "requests" },
	{ label: "Streaming tokens", value: 118_400, units: "tokens" },
	{ label: "Tool invocations", value: 19, units: "runs" },
] as const;

export const Route = createFileRoute("/settings/usage")({
	component: UsageSettings,
});

function UsageSettings() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Current Billing Cycle</CardTitle>
					<CardDescription>
						Keep an eye on how your workspace consumes model and tool credits.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6 text-sm">
					<div>
						<div className="flex items-center justify-between text-sm">
							<span className="font-medium">Token quota</span>
							<span className="text-muted-foreground">118k / 200k</span>
						</div>
						<Progress value={59} className="mt-2" />
					</div>
					<div>
						<div className="flex items-center justify-between text-sm">
							<span className="font-medium">Tool runtime budget</span>
							<span className="text-muted-foreground">12 / 30 hrs</span>
						</div>
						<Progress value={40} className="mt-2" />
					</div>
					<p className="text-muted-foreground text-xs">
						Limits reset on the first day of each month. Upgrade to raise shared
						workspace quotas.
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Breakdown</CardTitle>
					<CardDescription>
						Totals include both manual chats and scheduled automations.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-3">
					{usageBreakdown.map((item) => (
						<div
							key={item.label}
							className="rounded-lg border bg-background/60 p-4"
						>
							<p className="text-muted-foreground text-xs uppercase tracking-wide">
								{item.label}
							</p>
							<p className="font-semibold text-lg">
								{item.value.toLocaleString()}{" "}
								<span className="text-muted-foreground text-xs">
									{item.units}
								</span>
							</p>
						</div>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Notifications</CardTitle>
					<CardDescription>
						Usage alerts will email workspace admins when thresholds hit 80% and
						100%.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<p>
						Alerts: <span className="font-medium">Enabled</span>
					</p>
					<p className="text-muted-foreground text-xs">
						Configure notification recipients from the billing dashboard (coming
						soon).
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
