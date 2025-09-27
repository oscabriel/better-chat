"use client";

import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	BookText,
	Loader2,
	LogOutIcon,
	SettingsIcon,
	UserLock,
} from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/web/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/web/components/ui/dropdown-menu";
import { authClient } from "@/web/lib/auth-client";

const getFirstName = (
	user: { name?: string | null; email?: string | null } | null | undefined,
) => {
	if (!user) {
		return null;
	}
	return user.name?.trim().split(/\s+/)[0] ?? user.email ?? null;
};

export default function UserMenu() {
	const navigate = useNavigate();
	const { data } = authClient.useSession();
	const isCheckingSession = useRouterState({
		select: (state) => state.isLoading,
	});

	// Cache user name in localStorage to prevent flash on refresh
	useEffect(() => {
		if (data?.user?.name) {
			localStorage.setItem("cachedUserName", data.user.name);
		}
	}, [data?.user?.name]);

	// Try to get cached name if session is still loading
	const cachedName =
		!data?.user?.name && !isCheckingSession
			? localStorage.getItem("cachedUserName")
			: null;

	const displayFirstName = data?.user
		? (getFirstName(data.user) ?? "User")
		: cachedName
			? (getFirstName({ name: cachedName }) ?? "User")
			: null;

	if (isCheckingSession && !displayFirstName) {
		return (
			<div className="flex h-8 w-8 items-center justify-center rounded-md">
				<Loader2 className="h-4 w-4 animate-spin" />
			</div>
		);
	}

	if (!data?.user && !cachedName) {
		if (isCheckingSession && displayFirstName) {
			return (
				<Button variant="outline" size="sm" className="h-9 px-3" disabled>
					<span className="font-semibold text-sm">{displayFirstName}</span>
				</Button>
			);
		}
		return (
			<Button
				variant="outline"
				onClick={() => navigate({ to: "/auth/sign-in" })}
			>
				Sign In
			</Button>
		);
	}

	const handleSignOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					if (typeof window !== "undefined") {
						localStorage.removeItem("cachedUserName");
					}
					navigate({ to: "/" });
				},
			},
		});
	};

	const firstName = displayFirstName ?? "User";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="h-9 px-3">
					<span className="font-semibold text-sm">{firstName}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end" forceMount>
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="font-medium text-sm leading-none">
							{data?.user?.name || "User"}
						</p>
						<p className="text-muted-foreground text-xs leading-none">
							{data?.user?.email}
						</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
					<SettingsIcon className="h-4 w-4" />
					<span>Settings</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => navigate({ to: "/docs" })}>
					<BookText className="h-4 w-4" />
					<span>Docs</span>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => navigate({ to: "/policy" })}>
					<UserLock className="h-4 w-4" />
					<span>Privacy Policy</span>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleSignOut}>
					<LogOutIcon className="h-4 w-4" />
					<span>Sign Out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
