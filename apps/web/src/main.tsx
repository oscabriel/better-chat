import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { useMemo } from "react";
import ReactDOM from "react-dom/client";
import type { AuthContextValue } from "@/web/lib/auth-context";
import { AuthProvider, useAuth } from "@/web/lib/auth-context";
import { orpc, queryClient } from "./lib/orpc";
import { routeTree } from "./routeTree.gen";

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	context: { orpc, queryClient, auth: {} as AuthContextValue },
	Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	},
});

function AppRouter() {
	const auth = useAuth();
	const routerContext = useMemo(() => ({ orpc, queryClient, auth }), [auth]);

	return <RouterProvider router={router} context={routerContext} />;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("app");

if (!rootElement) {
	throw new Error("Root element not found");
}

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<AuthProvider>
			<AppRouter />
		</AuthProvider>,
	);
}
