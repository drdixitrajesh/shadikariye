CREATE TABLE `admin_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`target` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photo_cleanup` (
	`key` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`created_at` integer NOT NULL
);
