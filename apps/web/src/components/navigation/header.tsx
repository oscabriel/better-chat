import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/web/components/ui/button";
import { authClient } from "@/web/lib/auth-client";
import { ModeToggle } from "./mode-toggle";

export default function Header() {
	const { data: session } = authClient.useSession();
	const location = useRouterState({ select: (s) => s.location });
	const pathname = location.pathname ?? "";
	const isChatRoute = pathname === "/" || pathname.startsWith("/chat");

	const links = [
		{ to: "/", label: "Chat" },
		{ to: "/settings/profile", label: "Settings" },
	] as const;

	return (
		<div className="bg-background">
			<header className="fixed top-0 z-50 w-full bg-background/80 px-4 backdrop-blur-sm">
				<nav className="mx-auto flex max-w-5xl items-center justify-between py-4">
					<Link to="/" className="font-bold text-primary text-xl">
						<span className="text-3xl">☁️</span>{" "}
					</Link>
					<div className="flex items-center gap-6">
						{!session ? (
							<Button variant="outline" size="sm" className="h-9 px-3" asChild>
								<Link to="/auth/sign-in">Sign In</Link>
							</Button>
						) : (
							links.map(({ to, label }) => (
								<Link
									key={to}
									to={to}
									className="text-foreground underline decoration-muted-foreground transition-colors hover:decoration-foreground"
								>
									{label}
								</Link>
							))
						)}
						{isChatRoute && (
							<Button
								variant="ghost"
								size="icon"
								className="md:hidden"
								onClick={() =>
									window.dispatchEvent(
										new CustomEvent("better-t-chat:open-history"),
									)
								}
								aria-label="Open chat history"
								title="Chat history"
							>
								<span role="img" aria-hidden="true" className="text-xl">
									💬
								</span>
							</Button>
						)}
						<ModeToggle />
					</div>
				</nav>
			</header>
		</div>
	);
}
