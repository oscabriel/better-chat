/**
 * Cross-tab synchronization using BroadcastChannel API
 * Allows multiple tabs to stay in sync without polling
 */

type SyncEvent =
	| { type: "usage-changed" }
	| { type: "conversation-changed"; chatId: string }
	| { type: "conversations-list-changed" };

let channel: BroadcastChannel | null = null;

/**
 * Initialize the broadcast channel for cross-tab sync
 */
export function initSyncChannel(): BroadcastChannel | null {
	if (typeof window === "undefined") return null;
	if (!("BroadcastChannel" in window)) {
		console.warn("BroadcastChannel not supported in this browser");
		return null;
	}

	if (!channel) {
		channel = new BroadcastChannel("better-chat-sync");
	}

	return channel;
}

/**
 * Broadcast an event to all other tabs
 */
export function broadcastSync(event: SyncEvent): void {
	if (!channel) {
		channel = initSyncChannel();
	}
	channel?.postMessage(event);
}

/**
 * Listen for sync events from other tabs
 */
export function onSyncEvent(
	callback: (event: SyncEvent) => void,
): (() => void) | null {
	if (!channel) {
		channel = initSyncChannel();
	}

	if (!channel) return null;

	const handler = (event: MessageEvent<SyncEvent>) => {
		callback(event.data);
	};

	channel.addEventListener("message", handler);

	// Return cleanup function
	return () => {
		channel?.removeEventListener("message", handler);
	};
}

/**
 * Close the sync channel (call on unmount/cleanup)
 */
export function closeSyncChannel(): void {
	if (channel) {
		channel.close();
		channel = null;
	}
}
