CREATE TABLE `blocks` (
	`owner` text NOT NULL,
	`target` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `target`)
);
--> statement-breakpoint
CREATE TABLE `daily_views` (
	`owner` text NOT NULL,
	`day` text NOT NULL,
	`target` text NOT NULL,
	PRIMARY KEY(`owner`, `day`, `target`)
);
--> statement-breakpoint
CREATE TABLE `identity_locks` (
	`owner` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`birth_date` text NOT NULL,
	`aadhaar_last4` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `otp_accounts` (
	`owner` text PRIMARY KEY NOT NULL,
	`phone_hash` text NOT NULL,
	`phone_last4` text NOT NULL,
	`verified_at` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `otp_verified_phone` ON `otp_accounts` (`phone_hash`);--> statement-breakpoint
CREATE TABLE `otp_sends` (
	`owner` text NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner`, `day`)
);
--> statement-breakpoint
CREATE TABLE `profile_photos` (
	`profile_id` text NOT NULL,
	`slot` integer NOT NULL,
	`key` text NOT NULL,
	PRIMARY KEY(`profile_id`, `slot`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_photos_key_unique` ON `profile_photos` (`key`);--> statement-breakpoint
CREATE TABLE `profile_private` (
	`owner` text PRIMARY KEY NOT NULL,
	`references_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`target` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);

--> statement-breakpoint
INSERT OR IGNORE INTO profile_photos (profile_id,slot,key) SELECT id,0,photo_key FROM profiles WHERE photo_key IS NOT NULL;
