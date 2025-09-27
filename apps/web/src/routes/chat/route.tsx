import {
	createFileRoute,
	Navigate,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { ChatShell } from "@/web/components/chat/chat-shell";
import { ChatPending } from "@/web/components/page-skeleton";
import { authClient } from "@/web/lib/auth-client";

export const Route = createFileRoute("/chat")({
	component: ChatLayout,
	pendingComponent: ChatPending,
});

function ChatLayout() {
	const navigate = useNavigate();
	const location = useRouterState({ select: (state) => state.location });
	const { data: session, isPending } = authClient.useSession();

	useEffect(() => {
		const pathname = location.pathname ?? "";
		if (pathname === "/chat/" || pathname === "/chat") {
			void navigate({ to: "/chat", replace: true });
		}
	}, [location.pathname, navigate]);

	if (isPending) {
		return <ChatPending />;
	}

	if (!session?.user) {
		return (
			<Navigate
				to="/auth/sign-in"
				replace
				search={{ redirect: location.href ?? location.pathname ?? "/chat" }}
			/>
		);
	}

	return <ChatShell />;
}
