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
	`message` text NOT NULL,
	`role` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_conversation_created` ON `messages` (`conversation_id`,`created`);--> statement-breakpoint
CREATE TABLE `user_mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`headers` text DEFAULT '{}',
	`enabled` integer DEFAULT true,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`selected_model` text DEFAULT 'google:gemini-2.5-flash-lite',
	`api_keys` text DEFAULT '{}',
	`enabled_models` text DEFAULT '[]',
	`enabled_mcp_servers` text DEFAULT '["context7","cloudflare-docs"]',
	`theme` text DEFAULT 'system',
	`updated` integer NOT NULL
);
