import { MessageInput } from "@/web/routes/chat/-components/message-input";

interface ChatComposerProps {
	disabled: boolean;
	modelId: string | undefined;
	onModelChange: (id: string) => void;
	onSendMessage: (payload: { text: string }) => void;
	userApiKeys?: Record<string, string>;
	enabledModels?: string[];
}

export function ChatComposer({
	disabled,
	modelId,
	onModelChange,
	onSendMessage,
	userApiKeys,
	enabledModels,
}: ChatComposerProps) {
	return (
		<div className="shrink-0 border-t bg-background/60 px-4 py-4 sm:px-6">
			<div className="w-full">
				<MessageInput
					disabled={disabled}
					modelId={modelId}
					onModelChange={onModelChange}
					onSendMessage={onSendMessage}
					userApiKeys={userApiKeys}
					enabledModels={enabledModels}
				/>
			</div>
		</div>
	);
}
