ALTER TABLE `session_workflows` ADD `status` text DEFAULT 'running' NOT NULL;--> statement-breakpoint
ALTER TABLE `session_workflows` ADD `auto_approve` integer DEFAULT false NOT NULL;