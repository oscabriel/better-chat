import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/chat/")({
	component: ChatRoute,
});

function ChatRoute() {
	return null;
}
