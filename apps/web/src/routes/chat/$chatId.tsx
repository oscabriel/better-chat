import { useChat } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageInput } from "@/web/components/chat/message-input";
import { MessageRenderer } from "@/web/components/chat/message-renderer";
import { ChatPending } from "@/web/components/page-skeleton";
import { Button } from "@/web/components/ui/button";
import { Card } from "@/web/components/ui/card";
import {
	useUpdateUserSettings,
	useUserSettings,
} from "@/web/hooks/use-user-settings";
import { MAX_MESSAGE_BATCH } from "@/web/lib/constants";
import type {
	ConversationSummary,
	MessageListResponse,
} from "@/web/types/chat";
import { parseJsonResponse } from "@/web/utils/chat";
import { broadcastSync } from "@/web/utils/sync";

export const Route = createFileRoute("/chat/$chatId")({
	component: ChatPage,
	pendingComponent: ChatPending,
	loader: async ({ params }) => {
		const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;
		const { chatId } = params;

		// Prefetch messages before rendering to avoid flash of empty state
		try {
			const response = await fetch(
				`${apiBase}/chat/conversations/${chatId}/messages`,
				{
					credentials: "include",
				},
			);
			if (response.ok) {
				await response.json();
			}
		} catch (_) {
			// Ignore prefetch errors - component will handle them
		}
	},
});

function ChatPage() {
	const { chatId } = Route.useParams() as { chatId: string };
	const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;
	const queryClient = useQueryClient();
	const [pendingText, setPendingText] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const initializedChatId = useRef<string | null>(null);

	const messagesQuery = useQuery<MessageListResponse>({
		queryKey: ["chat", "messages", chatId],
		queryFn: async () => {
			const response = await fetch(
				`${apiBase}/chat/conversations/${chatId}/messages`,
				{
					credentials: "include",
				},
			);
			return parseJsonResponse<MessageListResponse>(response);
		},
		enabled: !!chatId,
		staleTime: 30_000,
		placeholderData: (previousData) => previousData,
	});

	const conversationQuery = useQuery({
		queryKey: ["chat", "conversation", chatId],
		queryFn: async () => {
			const response = await fetch(`${apiBase}/chat/conversations/${chatId}`, {
				credentials: "include",
			});
			if (!response.ok) {
				throw new Error("Conversation not found");
			}
			return parseJsonResponse(response);
		},
		staleTime: 30_000,
	});

	const deleteConversationMutation = useMutation({
		mutationFn: async () => {
			const response = await fetch(`${apiBase}/chat/conversations/${chatId}`, {
				method: "DELETE",
				credentials: "include",
			});
			if (!response.ok) {
				throw new Error("Failed to delete conversation");
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
			toast.success("Conversation deleted");
			void navigate({ to: "/chat" });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const navigate = useNavigate();

	const { messages, status, error, sendMessage, setMessages } = useChat({
		id: chatId,
		transport: new DefaultChatTransport({
			api: `${apiBase}/ai`,
			credentials: "include",
			body: () => ({
				// Use function syntax for dynamic config - values are resolved at request time
				conversationId: chatId,
				messages: messages.slice(-MAX_MESSAGE_BATCH),
				modelId: selectedModelId || undefined,
			}),
		}),
		experimental_throttle: 50,
		onFinish: async () => {
			// Invalidate queries to mark as stale and refetch when needed
			queryClient.invalidateQueries({
				queryKey: ["chat", "messages", chatId],
			});
			queryClient.invalidateQueries({
				queryKey: ["chat", "conversation", chatId],
			});
			// Only invalidate conversations list if this might be a new conversation (first few messages)
			if (messages.length <= 2) {
				queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
				broadcastSync({ type: "conversations-list-changed" });
			}
			// Invalidate usage queries since we just consumed tokens
			queryClient.invalidateQueries({ queryKey: ["usage", "current"] });
			queryClient.invalidateQueries({ queryKey: ["usage", "stats"] });

			// Broadcast changes to other tabs for cross-tab sync
			broadcastSync({ type: "usage-changed" });
			broadcastSync({ type: "conversation-changed", chatId });
		},
	});

	// Load messages from API only when navigating to a new chat
	// API now returns UIMessage[] directly (AI SDK v5 best practice)
	useEffect(() => {
		// Only load messages if this is a new chatId (not refetching the same chat)
		if (
			messagesQuery.data?.items &&
			!messagesQuery.isLoading &&
			initializedChatId.current !== chatId
		) {
			setMessages(messagesQuery.data.items);
			initializedChatId.current = chatId;
		}
	}, [chatId, messagesQuery.data?.items, messagesQuery.isLoading, setMessages]);

	useEffect(() => {
		if (typeof window !== "undefined") {
			const stored = sessionStorage.getItem(`better-t-chat:pending:${chatId}`);
			if (stored) {
				setPendingText(stored);
				sessionStorage.removeItem(`better-t-chat:pending:${chatId}`);
			}
		}
	}, [chatId]);

	useEffect(() => {
		if (
			pendingText &&
			status !== "streaming" &&
			messages.length === 0 &&
			!messagesQuery.isLoading &&
			!messagesQuery.isFetching &&
			messagesQuery.isSuccess
		) {
			try {
				sendMessage({ text: pendingText });
				setPendingText(null);
			} catch (error) {
				console.error("Failed to send pending message:", error);
				toast.error("Failed to send message");
				// Save back to session storage for retry
				if (typeof window !== "undefined") {
					try {
						sessionStorage.setItem(
							`better-t-chat:pending:${chatId}`,
							pendingText,
						);
					} catch (_) {
						// Ignore storage errors
					}
				}
				setPendingText(null);
			}
		}
	}, [
		pendingText,
		sendMessage,
		status,
		messages.length,
		messagesQuery.isLoading,
		messagesQuery.isFetching,
		messagesQuery.isSuccess,
		chatId,
	]);

	// Scroll to bottom when messages change
	// biome-ignore lint/correctness/useExhaustiveDependencies: We intentionally want to scroll when messages array changes
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleDeleteConversation = async () => {
		if (isDeleting) return;
		setIsDeleting(true);
		try {
			await deleteConversationMutation.mutateAsync();
		} finally {
			setIsDeleting(false);
		}
	};

	const [selectedModelId, setSelectedModelId] = useState<string | undefined>(
		undefined,
	);

	// Use shared settings hook
	const settingsQuery = useUserSettings();
	const updateSettings = useUpdateUserSettings();

	// Initialize selector with persisted user default when it becomes available
	useEffect(() => {
		if (!selectedModelId && settingsQuery.data?.selectedModel) {
			setSelectedModelId(settingsQuery.data.selectedModel);
		}
	}, [selectedModelId, settingsQuery.data?.selectedModel]);

	const handleModelChange = useCallback(
		async (id: string) => {
			setSelectedModelId(id);
			try {
				await updateSettings({ selectedModel: id });
			} catch (_) {
				// Ignore errors
			}
		},
		[updateSettings],
	);

	const title =
		(conversationQuery.data as ConversationSummary)?.title?.trim() ||
		"New chat";

	// Show loading state on initial fetch
	if (messagesQuery.isInitialLoading) {
		return <ChatPending />;
	}

	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex-shrink-0 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
				<div className="flex items-center justify-between">
					<div className="flex-1 truncate">
						<h1 className="font-semibold text-lg">{title}</h1>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleDeleteConversation}
							disabled={isDeleting}
						>
							<Trash2 className="h-4 w-4" />
							Delete
						</Button>
					</div>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
				<div className="w-full space-y-4">
					{messages.map((message) => (
						<MessageRenderer key={message.id} message={message} />
					))}
					{status === "streaming" && (
						<div className="flex justify-start">
							<Card className="max-w-[80%] gap-2 py-2">
								<div className="px-3 py-2">
									<p className="text-muted-foreground text-sm">Thinking...</p>
								</div>
							</Card>
						</div>
					)}
					{error && (
						<div className="flex justify-center">
							<Card className="gap-2 border-destructive bg-destructive/10 py-2">
								<div className="px-3 py-2">
									<p className="text-destructive text-sm">
										{error.message || "An error occurred"}
									</p>
								</div>
							</Card>
						</div>
					)}
					<div ref={messagesEndRef} />
				</div>
			</div>
			<div className="flex-shrink-0 border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
				<div className="w-full">
					<MessageInput
						disabled={status === "streaming"}
						modelId={selectedModelId}
						onModelChange={handleModelChange}
						onSendMessage={({ text }) => sendMessage({ text })}
					/>
				</div>
			</div>
		</div>
	);
}
