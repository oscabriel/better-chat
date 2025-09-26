import { createFileRoute } from "@tanstack/react-router";
import { SignInForm } from "./-components/sign-in-form";

export const Route = createFileRoute("/auth/sign-in")({
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch() as { redirect?: string };
	const redirectPath =
		typeof search.redirect === "string" && search.redirect.startsWith("/")
			? search.redirect
			: "/";

	return (
		<div className="container mx-auto w-full min-w-0 max-w-[90vw] px-3 py-2 sm:max-w-2xl sm:px-4 md:max-w-3xl">
			<SignInForm redirectPath={redirectPath} />
		</div>
	);
}
