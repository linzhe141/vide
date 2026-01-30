CREATE TABLE `thread_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text,
	`payload` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
