PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session_branches` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`name` text NOT NULL,
	`head_block_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`head_block_id`) REFERENCES `thread_workflow_blocks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_session_branches`("id", "thread_id", "name", "head_block_id", "created_at", "updated_at") SELECT "id", "thread_id", "name", "head_block_id", "created_at", "updated_at" FROM `session_branches`;--> statement-breakpoint
DROP TABLE `session_branches`;--> statement-breakpoint
ALTER TABLE `__new_session_branches` RENAME TO `session_branches`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `session_branches_thread_name_unique` ON `session_branches` (`thread_id`,`name`);--> statement-breakpoint
ALTER TABLE `thread_workflow_blocks` DROP COLUMN `branch_name`;