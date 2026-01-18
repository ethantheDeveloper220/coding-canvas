CREATE TABLE `file_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text,
	`sub_chat_id` text,
	`project_id` text NOT NULL,
	`operation_type` text NOT NULL,
	`file_path` text NOT NULL,
	`old_file_path` text,
	`old_content` text,
	`new_content` text,
	`worktree_path` text,
	`timestamp` integer DEFAULT (unixepoch('now')),
	`source` text,
	`session_id` text,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON DELETE cascade,
	FOREIGN KEY (`sub_chat_id`) REFERENCES `sub_chats`(`id`) ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade
);
