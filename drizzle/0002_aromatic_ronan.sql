CREATE TABLE `session_branches` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`name` text NOT NULL,
	`head_block_id` text,
	`created_from_block_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`head_block_id`) REFERENCES `thread_workflow_blocks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_from_block_id`) REFERENCES `thread_workflow_blocks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_branches_thread_name_unique` ON `session_branches` (`thread_id`,`name`);--> statement-breakpoint
ALTER TABLE `thread_workflow_blocks` ADD `parent_block_id` text REFERENCES thread_workflow_blocks(id);--> statement-breakpoint
ALTER TABLE `thread_workflow_blocks` ADD `branch_name` text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE `threads` ADD `active_branch` text DEFAULT 'main' NOT NULL;