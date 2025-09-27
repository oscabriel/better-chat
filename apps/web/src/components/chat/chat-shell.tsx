import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState, Outlet } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/web/components/ui/button";
import { Sheet, SheetContent } from "@/web/components/ui/sheet";
import { useIsMobile } from "@/web/hooks/use-mobile";
import { QUICK_PROMPTS } from "@/web/lib/constants";
import type { ConversationListResponse } from "@/web/types/chat";
import { generateConversationId, parseJsonResponse } from "@/web/utils/chat";
import { cn } from "@/web/utils/cn";
import { formatDistanceToNowStrict } from "@/web/utils/date";
import { MessageInput } from "./message-input";

export function ChatShell() {
	const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;
	const navigate = useNavigate();
	const location = useRouterState({ select: (state) => state.location });
	const isMobile = useIsMobile();
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
	const [creatingConversation, setCreatingConversation] = useState(false);

	useEffect(() => {
		const handler = () => setMobileSidebarOpen(true);
		window.addEventListener(
			"better-t-chat:open-history",
			handler as EventListener,
		);
		return () =>
			window.removeEventListener(
				"better-t-chat:open-history",
				handler as EventListener,
			);
	}, []);

	const conversationsQuery = useQuery<ConversationListResponse>({
		queryKey: ["chat", "conversations"],
		queryFn: async () => {
			const response = await fetch(`${apiBase}/chat/conversations`, {
				credentials: "include",
			});
			return parseJsonResponse<ConversationListResponse>(response);
		},
		staleTime: 30_000,
	});

	const selectedConversationId = useMemo(() => {
		const pathname = location.pathname ?? "";
		if (!pathname.startsWith("/chat")) {
			return null;
		}
		const [, base, maybeId] = pathname.split("/");
		if (base !== "chat" || !maybeId) {
			return null;
		}
		return decodeURIComponent(maybeId);
	}, [location.pathname]);

	useEffect(() => {
		if (selectedConversationId) {
			setCreatingConversation(false);
		}
	}, [selectedConversationId]);

	useEffect(() => {
		if (!isMobile) {
			setMobileSidebarOpen(false);
		}
	}, [isMobile]);

	const isConversationsLoading = conversationsQuery.isLoading;
	const conversations = conversationsQuery.data?.items ?? [];
	const hasActiveConversation = Boolean(selectedConversationId);

	const startNewConversation = () => {
		setCreatingConversation(false);
		setMobileSidebarOpen(false);
		void navigate({ to: "/chat" });
	};

	const handleSelectConversation = (conversationId: string) => {
		setMobileSidebarOpen(false);
		if (conversationId === selectedConversationId) {
			return;
		}
		void navigate({
			to: "/chat/$chatId",
			params: { chatId: conversationId },
		});
	};

	const handleStartNewChat = ({ text }: { text: string }) => {
		const safeText = (text || "").trim();
		if (!safeText || creatingConversation) {
			return;
		}
		setCreatingConversation(true);
		const newId = generateConversationId();
		if (typeof window !== "undefined") {
			try {
				sessionStorage.setItem(`better-t-chat:pending:${newId}`, safeText);
			} catch (_error) {
				// ignore storage errors (e.g., private mode)
			}
		}
		void navigate({
			to: "/chat/$chatId",
			params: { chatId: newId },
		});
	};

	const getConversationList = (onSelect: (id: string) => void) => {
		if (isConversationsLoading) {
			return (
				<div className="flex justify-center pt-4">
					<p className="text-muted-foreground text-sm">Loading chats...</p>
				</div>
			);
		}

		if (conversations.length === 0) {
			return (
				<div className="flex justify-center pt-4">
					<p className="text-muted-foreground text-sm">No chats found.</p>
				</div>
			);
		}

		return (
			<div className="space-y-2">
				{conversations.map((conversation) => {
					const isActive = conversation.id === selectedConversationId;
					const title = conversation.title?.trim() || "Untitled chat";
					const relativeUpdated = formatDistanceToNowStrict(
						new Date(conversation.updated),
						{ addSuffix: true },
					);
					return (
						<Button
							key={conversation.id}
							variant={isActive ? "secondary" : "ghost"}
							className={cn(
								"group flex h-auto w-full flex-col items-start justify-start gap-1 whitespace-normal border text-left text-sm",
								isActive
									? "border-primary bg-primary/10 text-primary hover:bg-primary/10"
									: "border-transparent bg-muted/40 text-foreground hover:border-muted hover:bg-muted",
							)}
							onClick={() => onSelect(conversation.id)}
						>
							<span className="w-full truncate font-medium">{title}</span>
							<span className="text-muted-foreground text-xs">
								Last message {relativeUpdated}
							</span>
						</Button>
					);
				})}
			</div>
		);
	};

	return (
		<div className="max-w-[100vw] overflow-x-hidden bg-background px-2 pt-20 sm:px-4">
			<div className="mx-auto flex min-h-[calc(100svh-5rem-1.5rem)] w-full min-w-0 max-w-5xl gap-2 px-1 sm:gap-4 sm:px-0 md:min-h-[calc(100svh-5rem-0.5rem)]">
				<aside className="relative hidden w-64 flex-shrink-0 md:block">
					<div className="sticky top-[5rem] flex h-[calc(100svh-5rem-1.5rem)] flex-col overflow-hidden rounded-lg border bg-card p-3 shadow-sm sm:p-4 md:h-[calc(100svh-5rem-0.5rem)]">
						<div className="mb-4">
							<h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
								Chat History
							</h2>
						</div>
						<Button
							onClick={startNewConversation}
							size="sm"
							className="mb-4 gap-2"
						>
							<Plus className="h-4 w-4" /> New Chat
						</Button>
						<div className="-mx-2 flex-1 overflow-y-auto px-2">
							{getConversationList(handleSelectConversation)}
						</div>
					</div>
				</aside>
				<section className="min-w-0 flex-1 basis-0">
					<div className="sticky top-[5rem] flex h-[calc(100svh-5rem-1.5rem)] max-w-[100vw] flex-col overflow-hidden rounded-lg border bg-card shadow-sm md:h-[calc(100svh-5rem-0.5rem)]">
						{hasActiveConversation ? (
							<Outlet />
						) : (
							<div className="flex h-full flex-col overflow-hidden">
								<div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
									<div className="mx-auto w-full max-w-3xl space-y-5 text-sm sm:text-base">
										<div>
											<h2 className="mb-2 font-bold text-3xl">
												What can I help you with?
											</h2>
										</div>
										<div className="flex flex-col items-start space-y-3">
											{QUICK_PROMPTS.map((prompt) => (
												<Button
													key={prompt.id}
													variant="ghost"
													className="h-auto justify-start gap-2 p-2 text-primary hover:text-primary"
													onClick={() =>
														handleStartNewChat({ text: prompt.text })
													}
													disabled={creatingConversation}
												>
													<span>{prompt.label}</span>
													<ArrowRight className="h-4 w-4" />
												</Button>
											))}
										</div>
									</div>
								</div>
								<div className="flex-shrink-0 border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
									<div className="mx-auto w-full max-w-3xl">
										<MessageInput
											disabled={creatingConversation}
											onSendMessage={handleStartNewChat}
										/>
									</div>
								</div>
							</div>
						)}
					</div>
				</section>
			</div>
		</div>
	);
}
