ALTER TABLE `identity_locks` ADD `profile_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE identity_locks SET profile_id=(SELECT id FROM profiles WHERE profiles.owner=identity_locks.owner) WHERE profile_id='' AND EXISTS (SELECT 1 FROM profiles WHERE profiles.owner=identity_locks.owner);
