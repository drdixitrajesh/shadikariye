ALTER TABLE portal_accounts ADD COLUMN mobile TEXT;
ALTER TABLE portal_accounts ADD COLUMN contact_email TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX portal_accounts_mobile ON portal_accounts(mobile) WHERE mobile IS NOT NULL;
