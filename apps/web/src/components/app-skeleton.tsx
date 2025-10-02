export function AppShellSkeleton() {
	return (
		<div className="max-w-[100vw] overflow-x-hidden bg-background px-2 pt-20 sm:px-4">
			<div className="mx-auto flex min-h-[calc(100svh-5rem-1.5rem)] w-full min-w-0 max-w-5xl gap-2 px-1 sm:gap-4 sm:px-0 md:min-h-[calc(100svh-5rem-0.5rem)]">
				<aside className="relative hidden w-64 flex-shrink-0 md:block">
					<div className="sticky top-[5rem] flex h-[calc(100svh-5rem-1.5rem)] flex-col overflow-hidden rounded-lg border bg-card p-3 shadow-sm sm:p-4 md:h-[calc(100svh-5rem-0.5rem)]" />
				</aside>
				<section className="min-w-0 flex-1 basis-0">
					<div className="sticky top-[5rem] flex h-[calc(100svh-5rem-1.5rem)] max-w-[100vw] flex-col overflow-hidden rounded-lg border bg-card shadow-sm md:h-[calc(100svh-5rem-0.5rem)]" />
				</section>
			</div>
		</div>
	);
}
