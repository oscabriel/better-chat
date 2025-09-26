import { useChat } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { Trash2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/web/components/ui/button";
import { Card } from "@/web/components/ui/card";
import { MAX_MESSAGE_BATCH, MAX_TEXT_LENGTH } from "@/web/lib/constants";
import type {
	ConversationListResponse,
	EnrichedMessage,
	MaybeEnrichedMessage,
	MessageListResponse,
} from "@/web/types/chat";
import {
	createContentKey,
	isTextPart,
	mapStoredMessages,
	normalizeToEnriched,
	parseJsonResponse,
} from "@/web/utils/chat";
import { cn } from "@/web/utils/cn";
import { MemoizedResponse } from "./-components/chat/memoized-response";
import { MessageInput } from "./-components/chat/message-input";

export const Route = createFileRoute("/_chat/chat/$chatId")({
	component: ChatPage,
});

const assistantProseClass = cn(
	// Base prose
	"prose prose-base dark:prose-invert max-w-none",
	// Text handling
	"break-words [overflow-wrap:anywhere]",
	// Headings
	"prose-headings:font-semibold prose-headings:text-foreground",
	"prose-h1:text-xl prose-h2:text-lg prose-h3:text-base",
	// Text elements
	"prose-p:my-2 prose-strong:text-foreground prose-p:leading-normal",
	// Links
	"prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
	// Lists
	"prose-ol:my-3 prose-ul:my-3 prose-li:mt-1 prose-li:mb-0 prose-li:marker:text-primary",
	"[&_ol>li>p]:my-0 [&_ul>li>p]:my-0",
	// Blockquotes
	"prose-blockquote:border-l-border prose-blockquote:bg-muted/50 prose-blockquote:pl-4 prose-blockquote:italic",
	// Code elements (simplified - detailed styling handled by CodeBlock component)
	"prose-pre:my-2 prose-pre:bg-transparent prose-pre:p-0",
	"prose-code:before:hidden prose-code:after:hidden",
);

function ChatPage() {
	const { chatId: conversationId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;

	const [history, setHistory] = useState<EnrichedMessage[]>([]);
	const [cursor, setCursor] = useState<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset state when route param changes
	useEffect(() => {
		setHistory([]);
		setCursor(null);
	}, [conversationId]);

	const messageQueryKey = useMemo(
		() => ["chat", "messages", conversationId] as const,
		[conversationId],
	);

	const historyQuery = useQuery<MessageListResponse>({
		queryKey: messageQueryKey,
		queryFn: async () => {
			const url = new URL(`${apiBase}/chat/messages`);
			url.searchParams.set("conversationId", conversationId);
			url.searchParams.set("limit", String(MAX_MESSAGE_BATCH / 2));
			const response = await fetch(url.toString(), {
				credentials: "include",
			});
			return parseJsonResponse<MessageListResponse>(response);
		},
		enabled: Boolean(conversationId),
		staleTime: 30_000,
	});

	const conversationsQuery = useQuery<ConversationListResponse>({
		queryKey: ["chat", "conversations"],
		queryFn: async () => {
			const response = await fetch(`${apiBase}/chat/conversations`, {
				credentials: "include",
			});
			return parseJsonResponse<ConversationListResponse>(response);
		},
		staleTime: 30_000,
		initialData: () =>
			queryClient.getQueryData<ConversationListResponse>([
				"chat",
				"conversations",
			]) ?? { items: [] },
	});

	useEffect(() => {
		if (historyQuery.error) {
			toast.error(historyQuery.error.message);
		}
	}, [historyQuery.error]);

	useEffect(() => {
		if (historyQuery.status !== "success" || !historyQuery.data) {
			return;
		}
		const data = historyQuery.data;
		setHistory(mapStoredMessages(data.items ?? []));
		setCursor(data.nextCursor ?? null);
	}, [historyQuery.data, historyQuery.status]);

	async function loadMore() {
		if (!cursor) return;
		try {
			const url = new URL(`${apiBase}/chat/messages`);
			url.searchParams.set("conversationId", conversationId);
			url.searchParams.set("limit", String(MAX_MESSAGE_BATCH / 2));
			url.searchParams.set("cursor", String(cursor));
			const response = await fetch(url.toString(), {
				credentials: "include",
			});
			const more = await parseJsonResponse<MessageListResponse>(response);
			const mapped = mapStoredMessages(more.items ?? []);
			setHistory((prev) => [...mapped, ...prev]);
			setCursor(more.nextCursor ?? null);
		} catch (error) {
			console.error(error);
			toast.error("Failed to load older messages");
		}
	}

	const deleteConversation = useMutation<
		{ id: string },
		Error,
		{ conversationId: string }
	>({
		mutationFn: async ({ conversationId }) => {
			const response = await fetch(
				`${apiBase}/chat/conversations/${conversationId}`,
				{
					method: "DELETE",
					credentials: "include",
				},
			);
			return parseJsonResponse<{ id: string }>(response);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
			queryClient.invalidateQueries({ queryKey: messageQueryKey });
			setHistory([]);
			setCursor(null);
			navigate({ to: "/", replace: true });
			toast.success("Conversation deleted");
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const { messages, status, error, clearError, sendMessage } = useChat({
		id: conversationId,
		transport: new DefaultChatTransport({
			api: `${import.meta.env.VITE_SERVER_URL}/api/ai`,
			credentials: "include",
			prepareSendMessagesRequest({ messages, id }) {
				const trimmed = messages.slice(-MAX_MESSAGE_BATCH);
				return {
					body: {
						id,
						conversationId,
						message: trimmed.at(-1) ?? null,
						messages: trimmed,
					},
				};
			},
		}),
		experimental_throttle: 50,
		onFinish: async () => {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
			await queryClient.invalidateQueries({
				queryKey: ["chat", "conversations"],
			});
			await queryClient.invalidateQueries({
				queryKey: messageQueryKey,
			});
		},
		onError: (chatError) => {
			console.error("Chat error:", chatError);
		},
	});

	const isStreamingAssistant = useMemo(() => {
		if (status !== "streaming" || messages.length === 0) {
			return false;
		}
		const lastMessage = messages[messages.length - 1];
		if (lastMessage.role !== "assistant") {
			return false;
		}
		return !lastMessage.parts?.some(isTextPart);
	}, [messages, status]);

	useEffect(() => {
		if (status === "streaming" || messages.length > 0) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages, status]);

	const mergedMessages = useMemo(() => {
		const result: EnrichedMessage[] = [];
		const seenIds = new Set<string>();
		const seenContent = new Set<string>();

		for (const item of history) {
			const enriched = normalizeToEnriched(item);
			const dedupeId =
				enriched.id ||
				createContentKey(enriched) ||
				`${enriched.role}:${enriched.created}`;
			result.push(enriched);
			if (dedupeId) {
				seenIds.add(dedupeId);
			}
			const contentKey = createContentKey(enriched);
			if (contentKey) {
				seenContent.add(contentKey);
			}
		}

		for (const item of messages) {
			const enriched = normalizeToEnriched(item as MaybeEnrichedMessage);
			const dedupeId =
				enriched.id ||
				createContentKey(enriched) ||
				`${enriched.role}:${enriched.created}`;
			if (dedupeId && seenIds.has(dedupeId)) {
				continue;
			}
			const contentKey = createContentKey(enriched);
			const isStreamingAssistant =
				status === "streaming" &&
				enriched.role === "assistant" &&
				item === messages[messages.length - 1];
			if (!isStreamingAssistant && contentKey && seenContent.has(contentKey)) {
				continue;
			}
			result.push(enriched);
			if (dedupeId) {
				seenIds.add(dedupeId);
			}
			if (contentKey) {
				seenContent.add(contentKey);
			}
		}

		return result;
	}, [history, messages, status]);

	const activeConversationTitle = useMemo(() => {
		const items = conversationsQuery.data?.items ?? [];
		return (
			items
				.find((conversation) => conversation.id === conversationId)
				?.title?.trim() || "Untitled chat"
		);
	}, [conversationsQuery.data?.items, conversationId]);

	const handleDeleteConversation = () => {
		if (deleteConversation.isPending) return;
		deleteConversation.mutate({ conversationId });
	};

	const handleSendMessage = ({ text }: { text: string }) => {
		const safeText = (text || "").slice(0, MAX_TEXT_LENGTH);
		if (!safeText) return;
		sendMessage({ text: safeText });
	};

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		const storageKey = `better-t-chat:pending:${conversationId}`;
		const stored = sessionStorage.getItem(storageKey);
		if (!stored) {
			return;
		}
		sessionStorage.removeItem(storageKey);
		const safeText = stored.slice(0, MAX_TEXT_LENGTH).trim();
		if (safeText) {
			sendMessage({ text: safeText });
		}
	}, [conversationId, sendMessage]);

	return (
		<div className="flex h-full max-w-[100vw] flex-col overflow-hidden">
			<div className="flex-shrink-0 border-b bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/75 sm:px-6 sm:py-4">
				<div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 sm:gap-3">
					<h2 className="truncate font-semibold text-foreground text-lg">
						{activeConversationTitle}
					</h2>
					<Button
						variant="ghost"
						size="icon"
						onClick={handleDeleteConversation}
						disabled={deleteConversation.isPending}
						className="text-muted-foreground hover:text-destructive"
						aria-label="Delete Chat"
						title="Delete Chat"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>
			<div className="max-w-[100vw] flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
				<div className="mx-auto w-full min-w-0 max-w-3xl space-y-4 px-0">
					<div className="mb-2 flex items-center justify-start">
						{cursor && (
							<Button
								size="sm"
								variant="outline"
								onClick={loadMore}
								disabled={historyQuery.isFetching}
							>
								Load previous messages
							</Button>
						)}
					</div>

					{mergedMessages.length === 0 && <div className="mb-8" />}
					{mergedMessages.map((message, index) => {
						const isUser = message.role === "user";
						const isNextSameAuthor =
							index < mergedMessages.length - 1 &&
							mergedMessages[index + 1]?.role === message.role;
						return (
							<Fragment key={message.id}>
								<div
									className={cn(
										"flex min-w-0",
										isUser ? "justify-end" : "justify-start",
									)}
								>
									<div
										className={cn(
											"min-w-0",
											isUser
												? [
														// User message bubble styling
														"ml-auto max-w-[80%] sm:max-w-[70%]",
														"whitespace-pre-wrap rounded-lg",
														"bg-primary text-primary-foreground",
														"px-3 py-2",
														"text-base leading-normal",
														"not-prose",
													]
												: [
														// Assistant message container
														"w-full max-w-full",
													],
										)}
									>
										{message.parts?.map((part) => {
											if (isTextPart(part)) {
												if (isUser) {
													/**
													 * USER MESSAGES: Plain text rendering
													 * - No markdown processing
													 * - Text styling inherited from parent container
													 * - Simple div wrapper for content
													 */
													return (
														<div key={`${message.id}-text`}>{part.text}</div>
													);
												}
												/**
												 * ASSISTANT MESSAGES: Full markdown rendering
												 * - Uses MemoizedResponse for performance
												 * - Applies assistantProseClass for typography
												 * - CodeBlock component handles code styling
												 */
												return (
													<MemoizedResponse
														key={`${message.id}-text`}
														content={part.text}
														id={message.id}
														proseClass={assistantProseClass}
													/>
												);
											}
											return null;
										}) || <p className="text-sm">Loading...</p>}
									</div>
								</div>
								{isNextSameAuthor ? null : <div className="h-3" />}
							</Fragment>
						);
					})}
					{isStreamingAssistant && (
						<div className="flex justify-start">
							<Card className="p-3">
								<div className="flex space-x-1">
									<div className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
									<div className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
									<div className="h-2 w-2 animate-bounce rounded-full bg-current" />
								</div>
							</Card>
						</div>
					)}
					<div ref={messagesEndRef} />
				</div>
			</div>
			<div className="flex-shrink-0 border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
				<div className="mx-auto w-full max-w-3xl">
					{error && (
						<div className="mb-2 flex items-center justify-between rounded-md bg-destructive/15 p-2 text-destructive text-sm">
							<span>Error: {error.message}</span>
							<Button size="sm" variant="outline" onClick={clearError}>
								Clear Error
							</Button>
						</div>
					)}
					<MessageInput
						disabled={status === "streaming"}
						onSendMessage={handleSendMessage}
					/>
				</div>
			</div>
		</div>
	);
}
