import { Card } from "@/web/components/ui/card";
import { cn } from "@/web/utils/cn";
import { MemoizedResponse } from "./memoized-response";
import { ReasoningBlock } from "./reasoning-block";
import { ToolCallBlock } from "./tool-call-block";

interface MessagePart {
	type: string;
	text?: string;
	toolName?: string;
	input?: unknown;
	output?: unknown;
	state?: string;
	errorText?: string;
	delta?: string;
	url?: string;
	mediaType?: string;
	name?: string;
}

interface MessageRendererProps {
	message: {
		id: string;
		role: "user" | "assistant" | "system";
		parts: MessagePart[];
	};
	proseClass?: string;
}

const defaultProseClass = cn(
	// Base prose
	"prose prose-base dark:prose-invert max-w-none",
	// Text handling
	"break-words [overflow-wrap:anywhere]",
	// Headings
	"prose-headings:font-semibold prose-headings:text-foreground",
	"prose-h1:mb-3 prose-h2:mb-2 prose-h3:mb-2 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base",
	// Text elements
	"prose-p:my-3 prose-strong:text-foreground prose-p:leading-relaxed",
	// Links
	"prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
	// Lists
	"prose-ol:my-4 prose-ul:my-4 prose-li:mt-2 prose-li:mb-1 prose-li:marker:text-primary",
	"[&_ol>li>p]:my-1 [&_ul>li>p]:my-1",
	// Blockquotes
	"prose-blockquote:my-4 prose-blockquote:border-l-border prose-blockquote:bg-muted/50 prose-blockquote:pl-4 prose-blockquote:italic",
	// Code elements
	"prose-pre:my-3 prose-pre:bg-transparent prose-pre:p-0",
	// Horizontal rules and tables
	"prose-hr:my-6 prose-table:my-4",
);

export function MessageRenderer({
	message,
	proseClass = defaultProseClass,
}: MessageRendererProps) {
	if (message.role === "user") {
		return (
			<div className="flex justify-end">
				<Card className="max-w-[80%] gap-2 bg-primary py-2 text-primary-foreground">
					<div className="px-3 py-2">
						{message.parts.map((part, index) => (
							<div key={index.toString()}>
								{part.type === "text" && part.text && (
									<p className="whitespace-pre-wrap text-sm">{part.text}</p>
								)}
								{part.type === "file" &&
									part.mediaType?.startsWith("image/") &&
									part.url && (
										<img
											src={part.url}
											alt="User upload"
											className="max-w-full rounded"
										/>
									)}
							</div>
						))}
					</div>
				</Card>
			</div>
		);
	}

	return (
		<div className="w-full">
			<div className="space-y-2">
				{message.parts.map((part, index) => (
					<PartRenderer
						key={index.toString()}
						part={part}
						messageId={message.id}
						proseClass={proseClass}
					/>
				))}
			</div>
		</div>
	);
}

function PartRenderer({
	part,
	messageId,
	proseClass,
}: {
	part: MessagePart;
	messageId: string;
	proseClass: string;
}) {
	// Skip internal/metadata parts that shouldn't be rendered
	if (part.type === "step-start" || part.type === "step-finish") {
		return null;
	}

	// Text content
	if (part.type === "text" && part.text) {
		return (
			<MemoizedResponse
				content={part.text}
				id={messageId}
				proseClass={proseClass}
			/>
		);
	}

	// Reasoning blocks
	if (part.type.startsWith("reasoning")) {
		return <ReasoningBlock part={part} />;
	}

	// Tool calls (MCP tools)
	if (part.type.startsWith("tool-") || part.toolName) {
		return <ToolCallBlock part={part} />;
	}

	// Skip rendering unknown part types silently
	return null;
}
