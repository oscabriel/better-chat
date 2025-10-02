/**
 * Message Parts Types
 *
 * Structured types for multimodal message content.
 * Messages contain an array of parts that can be text, images, reasoning, tool calls, etc.
 */

export type TextPart = {
	type: "text";
	text: string;
};

export type ReasoningPart = {
	type: "reasoning";
	reasoning: string;
};

export type ToolCallPart = {
	type: "tool-call";
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
};

export type ToolResultPart = {
	type: "tool-result";
	toolCallId: string;
	toolName: string;
	result: unknown;
	isError?: boolean;
};

export type ErrorPart = {
	type: "error";
	error: string;
};

/**
 * Union type of all possible message parts.
 * Use this for type-safe message part handling.
 */
export type MessagePart =
	| TextPart
	| ReasoningPart
	| ToolCallPart
	| ToolResultPart
	| ErrorPart;

/**
 * Type guard to check if a part is a text part
 */
export function isTextPart(part: MessagePart): part is TextPart {
	return part.type === "text";
}

/**
 * Type guard to check if a part is a reasoning part
 */
export function isReasoningPart(part: MessagePart): part is ReasoningPart {
	return part.type === "reasoning";
}

/**
 * Type guard to check if a part is a tool call part
 */
export function isToolCallPart(part: MessagePart): part is ToolCallPart {
	return part.type === "tool-call";
}

/**
 * Type guard to check if a part is a tool result part
 */
export function isToolResultPart(part: MessagePart): part is ToolResultPart {
	return part.type === "tool-result";
}

/**
 * Type guard to check if a part is an error part
 */
export function isErrorPart(part: MessagePart): part is ErrorPart {
	return part.type === "error";
}
