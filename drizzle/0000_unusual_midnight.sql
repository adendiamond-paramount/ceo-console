CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_content` text NOT NULL,
	`from` text NOT NULL,
	`possible_replies` text NOT NULL,
	`created_at` integer NOT NULL
);
