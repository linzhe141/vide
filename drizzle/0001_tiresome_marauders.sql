PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_thread_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text,
	`payload` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_thread_messages`("id", "thread_id", "role", "content", "payload", "created_at") SELECT "id", "thread_id", "role", "content", "payload", "created_at" FROM `thread_messages`;--> statement-breakpoint
DROP TABLE `thread_messages`;--> statement-breakpoint
ALTER TABLE `__new_thread_messages` RENAME TO `thread_messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_threads`("id", "title", "created_at", "updated_at") SELECT "id", "title", "created_at", "updated_at" FROM `threads`;--> statement-breakpoint
DROP TABLE `threads`;--> statement-breakpoint
ALTER TABLE `__new_threads` RENAME TO `threads`;