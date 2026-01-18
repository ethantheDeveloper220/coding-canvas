CREATE TABLE `roadmap_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`title` text NOT NULL,
	`column` text NOT NULL,
	`description` text,
	`priority` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now')),
	`updated_at` integer DEFAULT (unixepoch('now')),
	`completed_at` integer,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON DELETE cascade
);
