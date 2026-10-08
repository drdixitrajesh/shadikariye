CREATE TABLE `interests` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`sender_profile` text NOT NULL,
	`target` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_interests_target` ON `interests` (`target`);--> statement-breakpoint
CREATE INDEX `idx_interests_sender` ON `interests` (`sender`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_interests_pair` ON `interests` (`sender`,`target`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`interest_id` text NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_interest` ON `messages` (`interest_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL,
	`photo_key` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_owner_unique` ON `profiles` (`owner`);--> statement-breakpoint
CREATE TABLE `saved_profiles` (
	`owner` text NOT NULL,
	`target` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `target`)
);
