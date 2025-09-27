import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/web/components/ui/button";
import { useIsMobile } from "@/web/hooks/use-mobile";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

const CHAT_SIDEBAR_EVENT = "better-t-chat:open-history";
const SETTINGS_SIDEBAR_EVENT = "better-t-chat:open-settings";

export default function Header() {
	const location = useRouterState({ select: (state) => state.location });
	const isMobile = useIsMobile();
	const pathname = location.pathname ?? "";
	const isChatRoute = pathname.startsWith("/chat");
	const isSettingsRoute = pathname.startsWith("/settings");
	const showSidebarToggle = isMobile && (isChatRoute || isSettingsRoute);

	const handleToggleSidebar = () => {
		if (isChatRoute) {
			window.dispatchEvent(new CustomEvent(CHAT_SIDEBAR_EVENT));
			return;
		}
		if (isSettingsRoute) {
			window.dispatchEvent(new CustomEvent(SETTINGS_SIDEBAR_EVENT));
		}
	};

	return (
		<div className="bg-background">
			<header className="fixed top-0 z-50 w-full bg-background/80 px-4 backdrop-blur-sm">
				<nav className="mx-auto flex max-w-5xl items-center justify-between py-4">
					<div className="flex items-center gap-2">
						{showSidebarToggle && (
							<Button
								variant="ghost"
								size="icon"
								onClick={handleToggleSidebar}
								className="md:hidden"
							>
								<Menu className="h-5 w-5" />
							</Button>
						)}
						<Link
							to="/"
							className="flex items-center gap-2 font-semibold text-lg text-primary"
						>
							<span className="text-3xl">☁️</span>
						</Link>
					</div>
					<div className="flex items-center gap-2">
						<UserMenu />
						<ModeToggle />
					</div>
				</nav>
			</header>
		</div>
	);
}
