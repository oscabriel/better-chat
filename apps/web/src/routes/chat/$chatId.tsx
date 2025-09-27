import { useChat } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { Trash2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MemoizedResponse } from "@/web/components/chat/memoized-response";
import { MessageInput } from "@/web/components/chat/message-input";
import { ChatPending } from "@/web/components/page-skeleton";
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

export const Route = createFileRoute("/chat/$chatId")({
	component: ChatPage,
	pendingComponent: ChatPending,
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
);

function ChatPage() {
	const { chatId } = Route.useParams() as { chatId: string };
	const apiBase = `${import.meta.env.VITE_SERVER_URL}/api`;
	const queryClient = useQueryClient();
	const [pendingText, setPendingText] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

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

	const { messages, status, error, clearError, sendMessage } = useChat({
		id: chatId,
		transport: new DefaultChatTransport({
			api: `${apiBase}/ai`,
			credentials: "include",
			prepareSendMessagesRequest({ messages, id }) {
				const trimmed = messages.slice(-MAX_MESSAGE_BATCH);
				return {
					body: {
						id,
						conversationId: chatId,
						message: trimmed.at(-1) ?? null,
						messages: trimmed,
					},
				};
			},
		}),
		experimental_throttle: 50,
	});

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
		if (pendingText && status !== "streaming" && messages.length === 0) {
			sendMessage({ text: pendingText });
		}
	}, [pendingText, sendMessage, status, messages.length]);

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

	const enrichedMessages = useMemo(() => {
		return messages.map((msg) => {
			// Extract text content from the message parts
			const textContent =
				msg.parts?.find((part) => part.type === "text")?.text || "";
			return {
				id: msg.id,
				role: msg.role,
				parts: msg.parts?.length
					? msg.parts
					: [
							{
								type: "text",
								text: textContent,
							},
						],
				created: new Date().toISOString(),
			};
		});
	}, [messages]);

	const title = (conversationQuery.data as any)?.title?.trim() || "New chat";

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
			<div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
				<div className="mx-auto w-full max-w-3xl space-y-6">
					{enrichedMessages.map((message, index) => (
						<Fragment key={message.id || index}>
							{message.parts?.map((part, partIndex) => {
								if (isTextPart(part)) {
									if (message.role === "user") {
										return (
											<div
												key={"${message.id}-text"}
												className="flex justify-end"
											>
												<Card className="max-w-[80%] bg-primary text-primary-foreground">
													<div className="px-4 py-3">
														<p className="whitespace-pre-wrap text-sm">
															{part.text}
														</p>
													</div>
												</Card>
											</div>
										);
									}
									return (
										<div
											key={"${message.id}-text"}
											className="flex justify-start"
										>
											<Card className="max-w-[80%]">
												<div className="px-4 py-3">
													<MemoizedResponse
														content={part.text}
														id={message.id}
														proseClass={assistantProseClass}
													/>
												</div>
											</Card>
										</div>
									);
								}
								return null;
							})}
						</Fragment>
					))}
					{status === "streaming" && (
						<div className="flex justify-start">
							<Card className="max-w-[80%]">
								<div className="px-4 py-3">
									<p className="text-muted-foreground text-sm">Thinking...</p>
								</div>
							</Card>
						</div>
					)}
					{error && (
						<div className="flex justify-center">
							<Card className="border-destructive bg-destructive/10">
								<div className="px-4 py-3">
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
				<div className="mx-auto w-full max-w-3xl">
					<MessageInput
						disabled={status === "streaming"}
						onSendMessage={({ text }) => sendMessage({ text })}
					/>
				</div>
			</div>
		</div>
	);
}
