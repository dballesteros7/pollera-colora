CREATE TABLE `bonus_picks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	`category` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bonus_picks_user_group_category` ON `bonus_picks` (`user_id`,`group_id`,`category`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`invite_code` text NOT NULL,
	`organizer_id` text NOT NULL,
	`scoring_rules` text NOT NULL,
	`bonus_lock_at` integer,
	`pot_note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_invite_code_unique` ON `groups` (`invite_code`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fd_id` integer NOT NULL,
	`stage` text NOT NULL,
	`matchday` integer,
	`kickoff_utc` integer NOT NULL,
	`home_team` text,
	`away_team` text,
	`home_crest` text,
	`away_crest` text,
	`status` text NOT NULL,
	`duration` text,
	`reg_home` integer,
	`reg_away` integer,
	`final_home` integer,
	`final_away` integer,
	`manual_override` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_fd_id_unique` ON `matches` (`fd_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `group_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	`match_id` integer NOT NULL,
	`pred_home` integer NOT NULL,
	`pred_away` integer NOT NULL,
	`joker` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `predictions_user_group_match` ON `predictions` (`user_id`,`group_id`,`match_id`);--> statement-breakpoint
CREATE TABLE `prop_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` text NOT NULL,
	`user_id` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `prop_questions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prop_answers_question_user` ON `prop_answers` (`question_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `prop_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`proposer_id` text NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`question` text NOT NULL,
	`answer_type` text NOT NULL,
	`options` text,
	`points` integer NOT NULL,
	`match_id` integer,
	`lock_at` integer NOT NULL,
	`resolution_mode` text,
	`correct_value` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scores` (
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	`points_matches` integer DEFAULT 0 NOT NULL,
	`points_bonus` integer DEFAULT 0 NOT NULL,
	`points_props` integer DEFAULT 0 NOT NULL,
	`exact_count` integer DEFAULT 0 NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `group_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);