import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { GuestShellSkeleton } from "@/web/components/guest-skeleton";
import { Button } from "@/web/components/ui/button";
import { authClient } from "@/web/lib/auth-client";
import { APP_DESCRIPTIONS, APP_TITLE_ASCII } from "@/web/lib/constants";

export const Route = createFileRoute("/")({
	component: GuestRoute,
	pendingComponent: GuestShellSkeleton,
});

function GuestRoute() {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <GuestShellSkeleton />;
	}

	if (session?.user) {
		return <Navigate to="/chat" replace />;
	}

	return <GuestLanding />;
}

function GuestLanding() {
	return (
		<div className="min-h-screen bg-background px-4 pt-20">
			<div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 text-center">
				<pre className="overflow-x-auto font-mono text-[0.5rem] sm:text-xs md:text-sm">
					{APP_TITLE_ASCII}
				</pre>
				<div className="space-y-4">
					{APP_DESCRIPTIONS.map((description) => (
						<p
							key={description}
							className="text-base text-muted-foreground sm:text-lg"
						>
							{description}
						</p>
					))}
				</div>
				<div className="flex flex-wrap items-center justify-center gap-3">
					<Button asChild size="lg">
						<Link to="/auth/sign-in">Get started</Link>
					</Button>
					<Button asChild variant="outline" size="lg">
						<a
							href="https://github.com/oscargabriel/better-chat"
							target="_blank"
							rel="noreferrer"
						>
							View on GitHub
						</a>
					</Button>
				</div>
			</div>
		</div>
	);
}
