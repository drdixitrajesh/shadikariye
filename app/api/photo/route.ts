import {db,bucket,identity,json,errorResponse,validOrigin} from '@/lib/store';
import {requireVerified} from '@/lib/security';
export async function POST(request:Request){
  const owner=await identity();if(!owner)return json({error:'Sign in required'},401);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  if(Number(request.headers.get('content-length')??0)>4500000)return json({error:'Photo must be under 4 MB. / फोटो 4 MB से छोटी होनी चाहिए।'},413);
  try{
    const gate=await requireVerified(owner);if(gate)return gate;
    const profile=await db().prepare('SELECT id,photo_key FROM profiles WHERE owner=?').bind(owner).first<{id:string;photo_key:string|null}>();
    if(!profile)return json({error:'Create a profile first. / पहले प्रोफ़ाइल बनाएं।'},409);
    const form=await request.formData();const file=form.get('photo');
    const slot=Number(form.get('slot')??0);if(!Number.isInteger(slot)||slot<0||slot>4)return json({error:'अधिकतम पाँच फोटो। / Up to five photos.'},400);
    const old=await db().prepare('SELECT key FROM profile_photos WHERE profile_id=? AND slot=?').bind(profile.id,slot).first<{key:string}>();
    if(!(file instanceof File)||file.size>4194304||file.size<12)return json({error:'Choose a JPG, PNG or WebP photo under 4 MB. / 4 MB से छोटी JPG, PNG या WebP फोटो चुनें।'},400);
    const bytes=await file.arrayBuffer();const h=new Uint8Array(bytes);
    const mime=h[0]===0xff&&h[1]===0xd8&&h[2]===0xff?'image/jpeg':h[0]===0x89&&h[1]===0x50&&h[2]===0x4e&&h[3]===0x47?'image/png':String.fromCharCode(...h.slice(0,4))==='RIFF'&&String.fromCharCode(...h.slice(8,12))==='WEBP'?'image/webp':null;
    if(!mime)return json({error:'Only JPG, PNG and WebP photos are supported. / केवल JPG, PNG और WebP फोटो मान्य हैं।'},400);
    const key=crypto.randomUUID();await bucket().put(key,bytes,{httpMetadata:{contentType:mime}});
    try{await db().batch([db().prepare('INSERT INTO profile_photos (profile_id,slot,key) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM profiles WHERE id=? AND owner=?) ON CONFLICT(profile_id,slot) DO UPDATE SET key=excluded.key').bind(profile.id,slot,key,profile.id,owner),db().prepare(slot===0?'UPDATE profiles SET photo_key=?,updated_at=? WHERE owner=?':'UPDATE profiles SET updated_at=? WHERE owner=?').bind(...(slot===0?[key,Date.now(),owner]:[Date.now(),owner]))]);}catch(e){await bucket().delete(key);throw e;}
    const installed=await db().prepare('SELECT key FROM profile_photos WHERE profile_id=? AND slot=? AND key=?').bind(profile.id,slot,key).first();
    if(!installed){await bucket().delete(key);return json({error:'Profile changed. Retry.'},409);}
    const oldKey=old?.key??(slot===0?profile.photo_key:null);if(oldKey&&oldKey!==key)try{await bucket().delete(oldKey);}catch(e){console.error('Old photo cleanup failure',e);}
    return json({photoKey:key});
  }catch(e){return errorResponse(e);}
}
export async function DELETE(request:Request){
  const owner=await identity();if(!owner)return json({error:'Sign in required'},401);if(!validOrigin(request))return json({error:'Invalid origin'},403);
  try{
    const slot=Number(new URL(request.url).searchParams.get('slot'));if(!Number.isInteger(slot)||slot<0||slot>4)return json({error:'Invalid photo slot'},400);
    const row=await db().prepare('SELECT ph.key,p.id FROM profile_photos ph JOIN profiles p ON p.id=ph.profile_id WHERE p.owner=? AND ph.slot=?').bind(owner,slot).first<{key:string;id:string}>();if(!row)return json({ok:true});
    await db().batch([db().prepare('DELETE FROM profile_photos WHERE profile_id=? AND slot=? AND key=?').bind(row.id,slot,row.key),db().prepare('UPDATE profiles SET photo_key=NULL WHERE owner=? AND photo_key=?').bind(owner,row.key)]);await bucket().delete(row.key);return json({ok:true});
  }catch(e){return errorResponse(e);}
}
