-- Create question_preferences table for storing user's question answers
CREATE TABLE `question_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`sub_chat_id` text NOT NULL,
	`session_id` text,
	`request_id` text NOT NULL,
	`question_text` text NOT NULL,
	`question_header` text,
	`answer_text` text NOT NULL,
	`created_at` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`sub_chat_id`) REFERENCES `sub_chats`(`id`) ON UPDATE no action ON DELETE cascade
);
