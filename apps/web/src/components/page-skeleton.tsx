import { ExternalLink } from "lucide-react";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { useAppForm } from "@/web/components/ui/tanstack-form";
import { APP_DESCRIPTIONS, APP_TITLE_ASCII } from "@/web/lib/constants";
import {
	GitHubIcon,
	GoogleIcon,
} from "@/web/routes/auth/-components/social-sign-in-icons";

function AppSkeleton() {
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

export function ChatPending() {
	return <AppSkeleton />;
}

export function SettingsPending() {
	return <AppSkeleton />;
}

export function GuestPending() {
	return (
		<div className="min-h-screen bg-background px-4 pt-20">
			<div className="mx-auto max-w-3xl">
				<div className="mb-8">
					<pre className="mx-auto mb-4 overflow-x-auto text-center font-mono text-[0.5rem] sm:text-xs md:text-sm">
						{APP_TITLE_ASCII}
					</pre>
					{APP_DESCRIPTIONS.map((description) => (
						<p
							key={description}
							className="mb-6 text-center text-base text-muted-foreground sm:text-lg"
						>
							{description}
						</p>
					))}
				</div>
			</div>
		</div>
	);
}

export function DocsPending() {
	return (
		<div className="px-4 py-20">
			<div className="mx-auto max-w-3xl space-y-6">
				<div className="space-y-2">
					<div className="h-9 w-2/3 rounded-lg bg-muted" />
					<div className="h-4 w-full rounded bg-muted" />
					<div className="h-4 w-5/6 rounded bg-muted" />
				</div>
				<div className="space-y-3">
					<div className="h-6 w-1/2 rounded bg-muted" />
					<div className="h-4 w-full rounded bg-muted" />
					<div className="h-4 w-3/4 rounded bg-muted" />
					<div className="h-4 w-5/6 rounded bg-muted" />
				</div>
			</div>
		</div>
	);
}

export function PolicyPending() {
	return (
		<div className="px-4 py-20">
			<div className="mx-auto max-w-3xl space-y-6">
				<div className="space-y-2">
					<div className="h-9 w-1/2 rounded-lg bg-muted" />
					<div className="h-4 w-full rounded bg-muted" />
				</div>
				<div className="space-y-3">
					<div className="h-4 w-5/6 rounded bg-muted" />
					<div className="h-4 w-2/3 rounded bg-muted" />
					<div className="h-4 w-3/4 rounded bg-muted" />
				</div>
			</div>
		</div>
	);
}

export function SignInPending() {
	const emailForm = useAppForm({
		defaultValues: {
			email: "",
		},
	});

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-2 text-center font-bold text-3xl">Welcome ☁️</h1>
			<p className="mb-6 text-center text-muted-foreground">
				Choose a sign in method below.
			</p>
			<emailForm.AppForm>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						void emailForm.handleSubmit();
					}}
					className="space-y-4"
				>
					<emailForm.AppField name="email">
						{(field) => (
							<field.FormItem>
								<field.FormLabel>Email</field.FormLabel>
								<field.FormControl>
									<Input type="email" placeholder="you@example.com" />
								</field.FormControl>
								<field.FormMessage />
							</field.FormItem>
						)}
					</emailForm.AppField>

					<emailForm.Subscribe>
						{() => (
							<Button type="submit" className="w-full">
								Send verification code
							</Button>
						)}
					</emailForm.Subscribe>
				</form>
			</emailForm.AppForm>

			<div className="relative my-6">
				<div className="absolute inset-0 flex items-center">
					<div className="w-full border-gray-300 border-t dark:border-gray-600" />
				</div>
				<div className="relative flex justify-center text-sm">
					<span className="bg-background px-2 text-gray-500 dark:text-gray-400">
						OR
					</span>
				</div>
			</div>

			<div className="space-y-4">
				<Button className="relative flex w-full items-center justify-center space-x-2 border border-gray-300 bg-background text-foreground hover:bg-accent dark:border-gray-600">
					<GoogleIcon className="h-4 w-4" />
					<span>Sign in with Google</span>
				</Button>

				<Button className="relative flex w-full items-center justify-center space-x-2 border border-gray-300 bg-background text-foreground hover:bg-accent dark:border-gray-600">
					<GitHubIcon className="h-4 w-4" />
					<span>Sign in with GitHub</span>
				</Button>
			</div>

			<div className="mt-8 text-center text-muted-foreground text-sm italic">
				Authentication powered by{" "}
				<a
					href="https://better-auth.com"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-muted-foreground underline hover:text-muted-foreground/80"
				>
					Better Auth
					<ExternalLink className="h-3 w-3" />
				</a>
				<br />
				and Cloudflare D1+KV
			</div>
		</div>
	);
}
