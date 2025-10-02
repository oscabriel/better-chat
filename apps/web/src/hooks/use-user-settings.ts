import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { authClient } from "@/web/lib/auth-client";
import { parseJsonResponse } from "@/web/utils/chat";

export interface UserSettings {
	selectedModel: string;
	apiKeys: Record<string, string>;
	enabledModels: string[];
	enabledMcpServers: string[];
	theme: string;
	chatWidth: string;
}

/**
 * Shared hook for accessing user settings across the application.
 * This hook consolidates all user settings queries into a single query,
 * preventing excessive refetches and potential infinite loops.
 */
export function useUserSettings() {
	const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;
	const { data: session } = authClient.useSession();
	const userId = session?.user?.id;
	const isAuthenticated = !!userId;

	return useQuery<UserSettings>({
		// Include user ID in query key to prevent cache collision between users
		queryKey: ["user", "settings", userId ?? "anonymous"],
		queryFn: async () => {
			const response = await fetch(`${apiBase}/user/settings`, {
				credentials: "include",
			});
			return parseJsonResponse<UserSettings>(response);
		},
		staleTime: 30_000,
		refetchOnMount: false,
		retry: false,
		enabled: isAuthenticated,
	});
}

/**
 * Hook to update user settings with optimistic updates
 */
export function useUpdateUserSettings() {
	const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const userId = session?.user?.id;

	return useCallback(
		async (updates: Partial<UserSettings>) => {
			if (!userId) {
				throw new Error("User not authenticated");
			}

			const response = await fetch(`${apiBase}/user/settings`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(updates),
			});

			if (!response.ok) {
				throw new Error("Failed to update settings");
			}

			const updated = await parseJsonResponse<UserSettings>(response);

			// Update the cache with the server response using user-specific key
			queryClient.setQueryData(["user", "settings", userId], updated);

			return updated;
		},
		[queryClient, userId],
	);
}
