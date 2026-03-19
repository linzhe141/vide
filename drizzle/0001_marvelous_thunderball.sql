CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`artifact_workspace_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE no action
);
