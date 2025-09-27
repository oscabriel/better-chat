import { createFileRoute } from "@tanstack/react-router";
import { DocsPending } from "@/web/components/page-skeleton";
import { Button } from "@/web/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/web/components/ui/card";

export const Route = createFileRoute("/docs")({
	component: DocsRoute,
	pendingComponent: DocsPending,
});

function DocsRoute() {
	return (
		<div className="px-4 py-20">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
				<header className="text-center">
					<h1 className="font-bold text-4xl">Documentation</h1>
					<p className="mt-3 text-lg text-muted-foreground">
						Everything you need to build with better-chat.
					</p>
				</header>
				<section className="grid gap-6 lg:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>Quickstart</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4 text-muted-foreground text-sm">
							<p>Spin up both the API and frontend with Bun workspaces.</p>
							<ol className="list-decimal space-y-2 pl-5">
								<li>
									Install dependencies with <code>bun install</code>.
								</li>
								<li>
									Provision Cloudflare resources by running{" "}
									<code>bun db:push</code>.
								</li>
								<li>Start developing using the provided Turbo tasks.</li>
							</ol>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Core Concepts</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4 text-muted-foreground text-sm">
							<p>
								better-chat is powered by AI conversations stored in Cloudflare
								D1.
							</p>
							<ul className="list-disc space-y-2 pl-5">
								<li>Worker-hosted API built with Hono and tRPC.</li>
								<li>
									React 19 frontend using TanStack Router and React Query.
								</li>
								<li>
									Authentication via Better Auth with email OTP and providers.
								</li>
							</ul>
						</CardContent>
					</Card>
				</section>
				<footer className="flex flex-wrap items-center justify-center gap-4">
					<Button asChild size="lg">
						<a
							href="https://github.com/epicweb-dev/better-chat"
							target="_blank"
							rel="noreferrer"
						>
							View Source
						</a>
					</Button>
					<Button asChild variant="outline" size="lg">
						<a href="/policy">Privacy &amp; Usage Policy</a>
					</Button>
				</footer>
			</div>
		</div>
	);
}
