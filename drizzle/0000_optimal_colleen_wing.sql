CREATE TABLE `ask_user_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`block_id` text NOT NULL,
	`draft_json` text,
	`answer_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `thread_workflow_blocks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `planners` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`plan_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `thread_workflow_block_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`block_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text,
	`payload` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `thread_workflow_blocks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `thread_workflow_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`input` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
