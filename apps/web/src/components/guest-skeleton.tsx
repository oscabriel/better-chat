import { APP_DESCRIPTIONS, APP_TITLE_ASCII } from "@/web/lib/constants";
import { Button } from "./ui/button";

export function GuestShellSkeleton() {
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
						<span>Get started</span>
					</Button>
					<Button asChild variant="outline" size="lg">
						<span>View on GitHub</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
