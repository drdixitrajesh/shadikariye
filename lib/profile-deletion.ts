import {db,bucket} from '@/lib/store';
export async function flushPhotoCleanup(profileId?:string){
  const rows=await (profileId?db().prepare('SELECT key FROM photo_cleanup WHERE profile_id=? LIMIT 1000').bind(profileId):db().prepare('SELECT key FROM photo_cleanup ORDER BY created_at LIMIT 50')).all<{key:string}>();
  if(!rows.results.length)return true;
  try{await bucket().delete(rows.results.map(p=>p.key));await db().batch(rows.results.map(p=>db().prepare('DELETE FROM photo_cleanup WHERE key=?').bind(p.key)));return true;}
  catch{console.error('Photo cleanup pending; private files remain inaccessible through profile routes.');return false;}
}
export async function deleteStoredProfile(id:string,moderation?:{actor:string;reason:string}){
  const p=await db().prepare('SELECT id,owner FROM profiles WHERE id=?').bind(id).first<{id:string;owner:string}>();
  if(!p)return {deleted:false,cleanupPending:!await flushPhotoCleanup(id)};
  const now=Date.now();
  const statements=[
    db().prepare('INSERT OR IGNORE INTO photo_cleanup (key,profile_id,created_at) SELECT photo_key,id,? FROM profiles WHERE id=? AND photo_key IS NOT NULL UNION SELECT key,profile_id,? FROM profile_photos WHERE profile_id=?').bind(now,id,now,id),
    db().prepare('DELETE FROM messages WHERE interest_id IN (SELECT id FROM interests WHERE sender=? OR target=?)').bind(p.owner,id),
    db().prepare('DELETE FROM interests WHERE sender=? OR target=?').bind(p.owner,id),
    db().prepare('DELETE FROM saved_profiles WHERE owner=? OR target=?').bind(p.owner,id),
    db().prepare('DELETE FROM profile_photos WHERE profile_id=?').bind(id),
    db().prepare('DELETE FROM profile_private WHERE owner=?').bind(p.owner),
    db().prepare("UPDATE reports SET status='profile_removed' WHERE target=?").bind(id),
  ];
  if(moderation)statements.push(db().prepare("INSERT INTO admin_actions (id,actor,target,action,reason,created_at) SELECT ?,?,?,'delete_profile',?,? WHERE EXISTS (SELECT 1 FROM profiles WHERE id=?)").bind(crypto.randomUUID(),moderation.actor,id,moderation.reason,now,id));
  statements.push(db().prepare('DELETE FROM profiles WHERE id=?').bind(id));
  const results=await db().batch(statements);
  return {deleted:Boolean(results.at(-1)?.meta.changes),cleanupPending:!await flushPhotoCleanup(id)};
}
