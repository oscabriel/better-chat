import { createFileRoute } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/web/components/ui/card";

export const Route = createFileRoute("/policy")({
	component: PolicyRoute,
});

function PolicyRoute() {
	return (
		<div className="px-4 py-20">
			<div className="mx-auto w-full max-w-4xl space-y-10">
				<header className="space-y-3 text-center">
					<h1 className="font-bold text-4xl">Privacy &amp; Usage Policy</h1>
					<p className="text-lg text-muted-foreground">
						We respect your data and explain exactly how conversations are
						handled.
					</p>
				</header>
				<section className="grid gap-6 lg:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>Data Retention</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 text-muted-foreground text-sm">
							<p>
								Chat transcripts are stored in Cloudflare D1 and can be deleted
								at any time from your settings page.
							</p>
							<p>
								We never use your prompts to train external models. They remain
								scoped to your account.
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Acceptable Use</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 text-muted-foreground text-sm">
							<ul className="list-disc space-y-2 pl-5">
								<li>
									Do not upload sensitive personal data or production secrets.
								</li>
								<li>
									Respect third-party terms for any providers you connect.
								</li>
								<li>Report abuse to the team so we can investigate quickly.</li>
							</ul>
						</CardContent>
					</Card>
				</section>
				<section>
					<Card>
						<CardHeader>
							<CardTitle>Your Controls</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 text-muted-foreground text-sm">
							<p>
								Manage sessions, revoke tokens, and export data from the
								settings dashboard. Everything is accessible under{" "}
								<code>/settings</code>.
							</p>
							<p>
								Need more detail? Contact support via the feedback button in the
								header.
							</p>
						</CardContent>
					</Card>
				</section>
			</div>
		</div>
	);
}
