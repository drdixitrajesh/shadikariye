import {db,bucket,identity,json,errorResponse,validOrigin} from '@/lib/store';
import {flushPhotoCleanup} from '@/lib/profile-deletion';
import {isPortal} from '@/lib/portal-auth';
import {requireVerified} from '@/lib/security';
export async function POST(request:Request){
  const owner=await identity();if(!owner)return json({error:'Sign in required'},401);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  if(Number(request.headers.get('content-length')??0)>(isPortal()?280000:4500000))return json({error:isPortal()?'Photo must be at most 256 KiB. / फोटो अधिकतम 256 KiB हो।':'Photo must be under 4 MB. / फोटो 4 MB से छोटी होनी चाहिए।'},413);
  try{
    const gate=await requireVerified(owner);if(gate)return gate;
    const profile=await db().prepare('SELECT id,photo_key FROM profiles WHERE owner=?').bind(owner).first<{id:string;photo_key:string|null}>();
    if(!profile)return json({error:'Create a profile first. / पहले प्रोफ़ाइल बनाएं।'},409);
    const form=await request.formData();const file=form.get('photo');
    const slot=Number(form.get('slot')??0);if(!Number.isInteger(slot)||slot<0||slot>4)return json({error:'अधिकतम पाँच फोटो। / Up to five photos.'},400);
    const old=await db().prepare('SELECT key FROM profile_photos WHERE profile_id=? AND slot=?').bind(profile.id,slot).first<{key:string}>();
    if(!(file instanceof File)||file.size>(isPortal()?262144:4194304)||file.size<12)return json({error:'Choose a JPG, PNG or WebP photo under 4 MB. / 4 MB से छोटी JPG, PNG या WebP फोटो चुनें।'},400);
    const bytes=await file.arrayBuffer();const h=new Uint8Array(bytes);
    const mime=h[0]===0xff&&h[1]===0xd8&&h[2]===0xff?'image/jpeg':h[0]===0x89&&h[1]===0x50&&h[2]===0x4e&&h[3]===0x47?'image/png':String.fromCharCode(...h.slice(0,4))==='RIFF'&&String.fromCharCode(...h.slice(8,12))==='WEBP'?'image/webp':null;
    if(!mime)return json({error:'Only JPG, PNG and WebP photos are supported. / केवल JPG, PNG और WebP फोटो मान्य हैं।'},400);
    const oldKey=old?.key??(slot===0?profile.photo_key:null);
    const revision=crypto.randomUUID();const key=crypto.randomUUID();await bucket().put(key,bytes,{httpMetadata:{contentType:mime}});
    try{await db().batch([db().prepare('INSERT INTO profile_photos (profile_id,slot,key) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM profiles WHERE id=? AND owner=?) AND (? IS NULL OR EXISTS(SELECT 1 FROM profile_photos WHERE profile_id=? AND slot=? AND key=?)) ON CONFLICT(profile_id,slot) DO UPDATE SET key=excluded.key WHERE profile_photos.key=?').bind(profile.id,slot,key,profile.id,owner,old?.key??null,profile.id,slot,old?.key??null,old?.key??null),db().prepare('INSERT OR IGNORE INTO photo_cleanup(key,profile_id,created_at) SELECT ?,?,? WHERE ? IS NOT NULL AND ?<>? AND EXISTS(SELECT 1 FROM profile_photos WHERE profile_id=? AND slot=? AND key=?)').bind(oldKey,profile.id,Date.now(),oldKey,oldKey,key,profile.id,slot,key),db().prepare((slot===0?"UPDATE profiles SET photo_key=?,updated_at=?,data=json_set(data,'$.approvalStatus','pending','$.reviewToken',?,'$.reviewReason','') WHERE owner=?":"UPDATE profiles SET updated_at=?,data=json_set(data,'$.approvalStatus','pending','$.reviewToken',?,'$.reviewReason','') WHERE owner=?")+' AND EXISTS(SELECT 1 FROM profile_photos WHERE profile_id=? AND slot=? AND key=?)').bind(...(slot===0?[key,Date.now(),revision,owner]:[Date.now(),revision,owner]),profile.id,slot,key)]);}catch(e){await bucket().delete(key);throw e;}
    await flushPhotoCleanup(profile.id);
    const installed=await db().prepare('SELECT key FROM profile_photos WHERE profile_id=? AND slot=? AND key=?').bind(profile.id,slot,key).first();
    if(!installed){await bucket().delete(key);return json({error:'Profile changed. Retry.'},409);}

    return json({photoKey:key});
  }catch(e){return errorResponse(e);}
}
export async function DELETE(request:Request){
  const owner=await identity();if(!owner)return json({error:'Sign in required'},401);if(!validOrigin(request))return json({error:'Invalid origin'},403);
  try{
    const slot=Number(new URL(request.url).searchParams.get('slot'));if(!Number.isInteger(slot)||slot<0||slot>4)return json({error:'Invalid photo slot'},400);
    const row=await db().prepare('SELECT ph.key,p.id FROM profile_photos ph JOIN profiles p ON p.id=ph.profile_id WHERE p.owner=? AND ph.slot=?').bind(owner,slot).first<{key:string;id:string}>();if(!row)return json({ok:true});
    await db().batch([db().prepare('DELETE FROM profile_photos WHERE profile_id=? AND slot=? AND key=?').bind(row.id,slot,row.key),db().prepare("UPDATE profiles SET photo_key=CASE WHEN photo_key=? THEN NULL ELSE photo_key END,updated_at=?,data=json_set(data,'$.approvalStatus','pending','$.reviewToken',?,'$.reviewReason','') WHERE owner=? AND id=? AND NOT EXISTS(SELECT 1 FROM profile_photos WHERE profile_id=? AND slot=? AND key=?)").bind(row.key,Date.now(),crypto.randomUUID(),owner,row.id,row.id,slot,row.key)]);await bucket().delete(row.key);return json({ok:true});
  }catch(e){return errorResponse(e);}
}
