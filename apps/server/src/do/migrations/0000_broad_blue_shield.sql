CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`parts` text NOT NULL,
	`reasoning` text DEFAULT '[]' NOT NULL,
	`tool_calls` text DEFAULT '[]' NOT NULL,
	`tool_results` text DEFAULT '[]' NOT NULL,
	`error` text,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_conversation_created` ON `messages` (`conversation_id`,`created`);