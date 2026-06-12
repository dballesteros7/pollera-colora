CREATE TABLE `prop_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` text NOT NULL,
	`user_id` text NOT NULL,
	`vote` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `prop_questions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prop_votes_question_user` ON `prop_votes` (`question_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `prop_questions` ADD `eligible_count` integer;