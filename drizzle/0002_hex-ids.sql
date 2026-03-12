PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`message_content` text NOT NULL,
	`from` text NOT NULL,
	`channel` text,
	`possible_replies` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "message_content", "from", "channel", "possible_replies", "created_at") SELECT "id", "message_content", "from", "channel", "possible_replies", "created_at" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;