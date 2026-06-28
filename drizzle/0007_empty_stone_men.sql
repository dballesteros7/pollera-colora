CREATE TABLE `super_identities` (
	`user_id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`nickname` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
