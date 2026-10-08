// Calendar months, clamped to the final day when the target month is shorter.
export function sixMonthsAfter(timestamp:number){
  const offset=19_800_000; // Asia/Kolkata has no daylight-saving changes.
  const date=new Date(timestamp+offset),day=date.getUTCDate();
  date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+6);
  const lastDay=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  date.setUTCDate(Math.min(day,lastDay));return date.getTime()-offset;
}

// One atomic sweep before every website request, including anonymous reads.
// The same sweep can be attached to a Cron Trigger on a standalone Worker.
export async function expireProfiles(database:D1Database,photos:R2Bucket,now=Date.now()){
  const expired='SELECT id FROM profiles WHERE expires_at<=?';
  const owners='SELECT owner FROM profiles WHERE expires_at<=?';
  if(await database.prepare('SELECT 1 FROM profiles WHERE expires_at<=? LIMIT 1').bind(now).first()){
    await database.batch([
      database.prepare('INSERT OR IGNORE INTO photo_cleanup (key,profile_id,created_at) SELECT photo_key,id,? FROM profiles WHERE expires_at<=? AND photo_key IS NOT NULL UNION SELECT key,profile_id,? FROM profile_photos WHERE profile_id IN ('+expired+')').bind(now,now,now,now),
      database.prepare('DELETE FROM messages WHERE interest_id IN (SELECT id FROM interests WHERE sender IN ('+owners+') OR target IN ('+expired+'))').bind(now,now),
      database.prepare('DELETE FROM interests WHERE sender IN ('+owners+') OR target IN ('+expired+')').bind(now,now),
      database.prepare('DELETE FROM saved_profiles WHERE owner IN ('+owners+') OR target IN ('+expired+')').bind(now,now),
      database.prepare('DELETE FROM profile_private WHERE owner IN ('+owners+')').bind(now),
      database.prepare("UPDATE reports SET status='profile_removed' WHERE target IN ("+expired+')').bind(now),
      database.prepare('DELETE FROM profile_photos WHERE profile_id IN ('+expired+')').bind(now),
      database.prepare('DELETE FROM profiles WHERE expires_at<=?').bind(now),
    ]);
  }
  const pending=await database.prepare('SELECT key FROM photo_cleanup ORDER BY created_at LIMIT 50').all<{key:string}>();
  if(pending.results.length){
    try{
      await photos.delete(pending.results.map(p=>p.key));
      await database.batch(pending.results.map(p=>database.prepare('DELETE FROM photo_cleanup WHERE key=?').bind(p.key)));
    }catch{console.error('Expired photo cleanup pending; profile APIs cannot serve these files.');}
  }
}
