import { nanoid } from "nanoid";
import type { ApiErrorPayload } from "../types/chat";

/**
 * Chat-related utility functions
 */

export function generateConversationId(): string {
	return nanoid();
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
	let parsed: unknown = null;
	try {
		parsed = await response.json();
	} catch (_error) {
		parsed = null;
	}

	if (!response.ok) {
		let message = response.statusText || "Request failed";
		if (parsed && typeof parsed === "object") {
			const { error, message: bodyMessage } = parsed as ApiErrorPayload;
			if (typeof error === "string" && error.trim().length > 0) {
				message = error;
			} else if (
				typeof bodyMessage === "string" &&
				bodyMessage.trim().length > 0
			) {
				message = bodyMessage;
			}
		}
		throw new Error(message);
	}

	return parsed as T;
}
