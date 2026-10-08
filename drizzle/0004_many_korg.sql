ALTER TABLE `profiles` ADD `published_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `expires_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_profiles_expires_at` ON `profiles` (`expires_at`);
--> statement-breakpoint
UPDATE profiles SET published_at=updated_at;
--> statement-breakpoint
UPDATE profiles SET expires_at=CAST(strftime('%s',date((published_at+19800000)/1000,'unixepoch','start of month','+6 months'), '+' || (min(CAST(strftime('%d',(published_at+19800000)/1000,'unixepoch') AS INTEGER),CAST(strftime('%d',date((published_at+19800000)/1000,'unixepoch','start of month','+7 months','-1 day')) AS INTEGER))-1) || ' days') AS INTEGER)*1000 + ((published_at+19800000) % 86400000) - 19800000;
--> statement-breakpoint
PRAGMA optimize;
