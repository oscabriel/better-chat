import {
	createLazyFileRoute,
	Link,
	Navigate,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader } from "@/web/components/navigation/loader";
import { authClient } from "@/web/lib/auth-client";
import { cn } from "@/web/utils/cn";

const NAV_ITEMS = [
	{
		to: "/settings/profile",
		label: "Profile",
		description: "Account details & sessions",
	},
	{
		to: "/settings/providers",
		label: "Providers",
		description: "Manage API providers",
	},
	{
		to: "/settings/models",
		label: "Models",
		description: "Default model preferences",
	},
	{
		to: "/settings/tools",
		label: "Tools",
		description: "Workspace tool integrations",
	},
	{
		to: "/settings/appearance",
		label: "Appearance",
		description: "Theme & UI density",
	},
	{
		to: "/settings/usage",
		label: "Usage",
		description: "Quota & billing insights",
	},
] as const;

export const Route = createLazyFileRoute("/settings")({
	component: SettingsLayout,
});

function SettingsLayout() {
	const navigate = useNavigate();
	const location = useRouterState({ select: (state) => state.location });
	const { data: session, isPending } = authClient.useSession();

	useEffect(() => {
		const pathname = location.pathname ?? "";
		if (pathname === "/settings" || pathname === "/settings/") {
			void navigate({ to: "/settings/profile", replace: true });
		}
	}, [location.pathname, navigate]);

	if (isPending) {
		return <Loader />;
	}

	if (!session?.user) {
		return (
			<Navigate
				to="/auth/sign-in"
				replace
				search={{ redirect: location.href ?? location.pathname ?? "/settings" }}
			/>
		);
	}

	const activePath = location.pathname ?? "";

	return (
		<div className="max-w-[100vw] overflow-x-hidden bg-background px-2 pt-20 sm:px-4">
			<div className="mx-auto flex min-h-[calc(100svh-5rem-1.5rem)] w-full min-w-0 max-w-5xl gap-2 px-1 sm:gap-4 sm:px-0 md:min-h-[calc(100svh-5rem-0.5rem)]">
				<aside className="relative hidden w-64 flex-shrink-0 md:block">
					<div className="sticky top-[5rem] flex h-[calc(100svh-5rem-1.5rem)] flex-col overflow-hidden rounded-lg border bg-card p-3 shadow-sm sm:p-4 md:h-[calc(100svh-5rem-0.5rem)]">
						<div className="mb-4">
							<h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
								Settings
							</h2>
						</div>
						<div className="-mx-1 flex-1 overflow-y-auto px-1">
							<div className="space-y-2">
								{NAV_ITEMS.map((item) => {
									const isActive =
										activePath === item.to ||
										activePath.startsWith(`${item.to}/`);
									return (
										<Link
											key={item.to}
											to={item.to}
											className={cn(
												"block rounded-lg border px-3 py-3 transition",
												isActive
													? "border-primary bg-primary/10 text-primary"
													: "border-transparent bg-muted/40 text-foreground hover:border-muted hover:bg-muted",
											)}
											preload="intent"
										>
											<div className="font-semibold text-sm">{item.label}</div>
											<p className="text-muted-foreground text-xs">
												{item.description}
											</p>
										</Link>
									);
								})}
							</div>
						</div>
					</div>
				</aside>
				<section className="min-w-0 flex-1 basis-0">
					<div className="mb-4 space-y-2 md:hidden">
						{NAV_ITEMS.map((item) => {
							const isActive =
								activePath === item.to || activePath.startsWith(`${item.to}/`);
							return (
								<Link
									key={item.to}
									to={item.to}
									className={cn(
										"block rounded-lg border px-3 py-3 transition",
										isActive
											? "border-primary bg-primary/10 text-primary"
											: "border-transparent bg-muted/40 text-foreground hover:border-muted hover:bg-muted",
									)}
									preload="intent"
								>
									<div className="font-semibold text-sm">{item.label}</div>
									<p className="text-muted-foreground text-xs">
										{item.description}
									</p>
								</Link>
							);
						})}
					</div>
					<div className="sticky top-[5rem] flex min-h-[calc(100svh-5rem-1.5rem)] max-w-[100vw] flex-col overflow-hidden rounded-lg border bg-card shadow-sm md:min-h-[calc(100svh-5rem-0.5rem)]">
						<div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
							<Outlet />
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
