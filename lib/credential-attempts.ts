export const MAX_CREDENTIAL_ATTEMPTS=3;
export const CREDENTIAL_LOCK_MS=15*60*1000;

// Reserve before credential verification so concurrent requests cannot all
// pass the limit. Attempt three starts a full 15-minute lock; success clears it.
export async function reserveCredentialAttempt(db:D1Database,key:string,now=Date.now()){
  const row=await db.prepare(`INSERT INTO portal_credential_attempts(key,attempts,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET
      attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,
      expires_at=CASE WHEN expires_at<=? OR attempts=? THEN ? ELSE expires_at END
    WHERE attempts<? OR expires_at<=? RETURNING key`)
    .bind(key,now+CREDENTIAL_LOCK_MS,now,now,MAX_CREDENTIAL_ATTEMPTS-1,now+CREDENTIAL_LOCK_MS,MAX_CREDENTIAL_ATTEMPTS,now).first();
  return Boolean(row);
}
export async function clearCredentialAttempts(db:D1Database,key:string){await db.prepare('DELETE FROM portal_credential_attempts WHERE key=?').bind(key).run();}
