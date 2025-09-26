import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "@/web/lib/auth-client";
import { APP_DESCRIPTIONS, APP_TITLE_ASCII } from "@/web/lib/constants";

export const Route = createFileRoute("/_chat/")({
	component: ChatIndexRoute,
});

function ChatIndexRoute() {
	const { data: session } = authClient.useSession();

	if (session?.user) {
		return null;
	}

	return <LandingHero />;
}

function LandingHero() {
	return (
		<div className="min-h-screen bg-background px-4 pt-20">
			<div className="mx-auto max-w-3xl">
				<div className="mb-8">
					<pre className="mx-auto mb-4 overflow-x-auto text-center font-mono text-[0.5rem] sm:text-xs md:text-sm">
						{APP_TITLE_ASCII}
					</pre>
					{APP_DESCRIPTIONS.map((description) => (
						<p
							key={description}
							className="mb-6 text-center text-base text-muted-foreground sm:text-lg"
						>
							{description}
						</p>
					))}
				</div>
			</div>
		</div>
	);
}
