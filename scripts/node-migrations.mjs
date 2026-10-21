// Existing installations retain their accounts. New columns default to no contact.
export async function migrateAccountContacts(db){
  const columns=await db.prepare('PRAGMA table_info(portal_accounts)').all();
  const names=new Set(columns.results.map(column=>column.name));
  if(!names.has('id'))throw new Error('Account database is missing.');
  const statements=[];
  if(!names.has('mobile'))statements.push(db.prepare('ALTER TABLE portal_accounts ADD COLUMN mobile TEXT'));
  if(!names.has('contact_email'))statements.push(db.prepare("ALTER TABLE portal_accounts ADD COLUMN contact_email TEXT NOT NULL DEFAULT ''"));
  statements.push(db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS portal_accounts_mobile ON portal_accounts(mobile) WHERE mobile IS NOT NULL'));
  statements.push(db.prepare('CREATE TABLE IF NOT EXISTS portal_credential_attempts(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL)'));
  statements.push(db.prepare('CREATE TABLE IF NOT EXISTS portal_recovery_requests(account_id TEXT PRIMARY KEY,requested_at INTEGER NOT NULL,resolved_at INTEGER,reviewed_by TEXT)'));
  await db.batch(statements);
}
