CREATE INDEX `bonus_picks_group` ON `bonus_picks` (`group_id`);--> statement-breakpoint
CREATE INDEX `memberships_group` ON `memberships` (`group_id`);--> statement-breakpoint
CREATE INDEX `otp_codes_email` ON `otp_codes` (`email`);--> statement-breakpoint
CREATE INDEX `predictions_group_match` ON `predictions` (`group_id`,`match_id`);--> statement-breakpoint
CREATE INDEX `prop_questions_group` ON `prop_questions` (`group_id`);