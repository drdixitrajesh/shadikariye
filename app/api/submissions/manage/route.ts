import {env} from 'cloudflare:workers';
import {db,bucket,json,errorResponse,validOrigin} from '@/lib/store';
import {isPortal,readBody,throttle} from '@/lib/portal-auth';
import {portalUser} from '@/lib/portal-context';
import {managedSubmission} from '@/lib/submission-management';
import {privateProfileSchema} from '@/lib/profile-input';
import {validateProfile} from '@/lib/matrimony';
import {ageFromDate} from '@/lib/security';
import {validLocation} from '@/lib/location-validation';
import {normalizeMobile} from '@/lib/account-contact';
import {sanitizePhoto} from '@/lib/portal-photos';
import {flushPhotoCleanup} from '@/lib/profile-deletion';

export async function POST(request:Request){
  if(!isPortal())return json({error:'Unavailable'},404);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  const uploaded:string[]=[];let committed=false;
  try{
    if(!await throttle(request,'submission-manage','all',{ip:60,subject:240,global:240}))return json({error:'15 मिनट बाद प्रयास करें।'},429);
    if(Number(request.headers.get('content-length')??0)>1500000)return json({error:'फोटो का आकार घटाकर फिर प्रयास करें।'},413);
    const multipart=request.headers.get('content-type')?.startsWith('multipart/form-data');
    const form=multipart?await request.formData():null;
    const body=form?JSON.parse(String(form.get('details')??'{}')):await readBody(request);
    if(!body||Array.isArray(body)||typeof body!=='object')return json({error:'जानकारी जाँचें।'},400);
    const row=await managedSubmission(body.token);
    if(!row)return json({error:'निजी लिंक अमान्य है या समाप्त हो गया है। नया लिंक पाने के लिए सहायता अनुरोध भेजें।'},404);
    const now=Date.now(),data=JSON.parse(row.data);
    const lock=await db().prepare('SELECT name,birth_date,aadhaar_last4 FROM identity_locks WHERE owner=?').bind(row.owner).first<{name:string;birth_date:string;aadhaar_last4:string}>();
    const contact=await db().prepare('SELECT mobile FROM submission_contacts WHERE owner=?').bind(row.owner).first<{mobile:string}>();
    const photos=await db().prepare('SELECT slot,key FROM profile_photos WHERE profile_id=? ORDER BY slot').bind(row.id).all<{slot:number;key:string}>();
    if(row.photo_key&&!photos.results.some(p=>p.key===row.photo_key))photos.results.unshift({slot:0,key:row.photo_key});
    if(body.action==='photo'){
      if(typeof body.key!=='string'||!photos.results.some(p=>p.key===body.key))return json({error:'फोटो नहीं मिली।'},404);
      const photo=await bucket().get(body.key);if(!photo)return json({error:'फोटो नहीं मिली।'},404);
      if(!env.PHOTO_PROTECTION)return json({error:'फोटो अभी उपलब्ध नहीं है।'},503);
      const bytes=await env.PHOTO_PROTECTION.render(photo.body,row.hash.slice(0,10));
      return new Response(bytes,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
    }
    if(body.action==='claim'){
      const user=portalUser();if(!user||user.role!=='member')return json({error:'उसी मोबाइल वाले सदस्य खाते से login करें।'},401);
      const account=await db().prepare("SELECT mobile FROM portal_accounts WHERE id=? AND role='member' AND status='active'").bind(user.id).first<{mobile:string}>();
      if(!account||!contact||normalizeMobile(account.mobile)!==contact.mobile)return json({error:'खाते का मोबाइल पोस्ट के संपर्क मोबाइल से मेल नहीं खाता। Admin से सहायता लें।'},403);
      if(await db().prepare('SELECT 1 FROM identity_locks WHERE owner=? UNION SELECT 1 FROM profiles WHERE owner=?').bind(user.id,user.id).first())return json({error:'इस खाते की प्रोफ़ाइल पहले से है। Admin से सहायता लें।'},409);
      // The secret link is proof of control; a matching, unverified phone alone is never sufficient.
      const result=await db().batch([
        db().prepare('UPDATE profiles SET owner=? WHERE id=? AND owner=? AND expires_at>? AND EXISTS(SELECT 1 FROM submission_access WHERE owner=? AND token_hash=? AND expires_at>?) AND NOT EXISTS(SELECT 1 FROM identity_locks WHERE owner=?) AND NOT EXISTS(SELECT 1 FROM profiles WHERE owner=?)').bind(user.id,row.id,row.owner,now,row.owner,row.hash,now,user.id,user.id),
        db().prepare('UPDATE identity_locks SET owner=? WHERE owner=? AND EXISTS(SELECT 1 FROM profiles WHERE id=? AND owner=?)').bind(user.id,row.owner,row.id,user.id),
        db().prepare('UPDATE profile_private SET owner=? WHERE owner=? AND EXISTS(SELECT 1 FROM profiles WHERE id=? AND owner=?)').bind(user.id,row.owner,row.id,user.id),
        db().prepare('UPDATE submission_contacts SET owner=? WHERE owner=? AND EXISTS(SELECT 1 FROM profiles WHERE id=? AND owner=?)').bind(user.id,row.owner,row.id,user.id),
        ...['submission_access','submission_recovery_requests'].map(t=>db().prepare(`DELETE FROM ${t} WHERE owner=? AND EXISTS(SELECT 1 FROM profiles WHERE id=? AND owner=?)`).bind(row.owner,row.id,user.id)),
        db().prepare("DELETE FROM portal_accounts WHERE id=? AND status='invited' AND password_hash IS NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=? AND owner=?)").bind(row.owner,row.id,user.id),
        db().prepare("INSERT INTO admin_actions(id,actor,target,action,reason,created_at) SELECT ?,?,?,'claim_submission','Private link and matching account mobile',? WHERE EXISTS(SELECT 1 FROM profiles WHERE id=? AND owner=?)").bind(crypto.randomUUID(),user.id,row.id,now,row.id,user.id),
      ]);
      return result[0].meta.changes?json({ok:true,claimed:true}):json({error:'प्रोफ़ाइल बदल गई है। पेज फिर खोलें।'},409);
    }
    if(body.action==='delete'){
      if(typeof body.confirmation!=='string'||body.confirmation.trim()!==data.name)return json({error:'पुष्टि के लिए प्रोफ़ाइल का पूरा नाम सही लिखें।'},400);
      if(body.confirmation!==data.name)return json({error:'पुष्टि के लिए प्रोफ़ाइल का पूरा नाम सही लिखें।'},400);
      const guard='EXISTS(SELECT 1 FROM profiles p JOIN submission_access a ON a.owner=p.owner WHERE p.id=? AND p.owner=? AND a.token_hash=? AND a.expires_at>? AND p.expires_at>?)';
      const args=[row.id,row.owner,row.hash,now,now];
      const result=await db().batch([
        db().prepare(`INSERT OR IGNORE INTO photo_cleanup(key,profile_id,created_at) SELECT key,profile_id,? FROM profile_photos WHERE profile_id=? AND ${guard}`).bind(now,row.id,...args),
        db().prepare(`INSERT OR IGNORE INTO photo_cleanup(key,profile_id,created_at) SELECT photo_key,id,? FROM profiles WHERE id=? AND photo_key IS NOT NULL AND ${guard}`).bind(now,row.id,...args),
        db().prepare(`DELETE FROM messages WHERE interest_id IN(SELECT id FROM interests WHERE sender=? OR target=?) AND ${guard}`).bind(row.owner,row.id,...args),
        db().prepare(`DELETE FROM interests WHERE (sender=? OR target=?) AND ${guard}`).bind(row.owner,row.id,...args),
        db().prepare(`DELETE FROM saved_profiles WHERE (owner=? OR target=?) AND ${guard}`).bind(row.owner,row.id,...args),
        db().prepare(`DELETE FROM profile_photos WHERE profile_id=? AND ${guard}`).bind(row.id,...args),
        db().prepare(`DELETE FROM profile_private WHERE owner=? AND ${guard}`).bind(row.owner,...args),
        db().prepare(`UPDATE reports SET status='profile_removed' WHERE target=? AND ${guard}`).bind(row.id,...args),
        db().prepare(`DELETE FROM profiles WHERE id=? AND ${guard}`).bind(row.id,...args),
        ...['submission_access','submission_recovery_requests'].map(t=>db().prepare(`DELETE FROM ${t} WHERE owner=? AND NOT EXISTS(SELECT 1 FROM profiles WHERE id=?)`).bind(row.owner,row.id)),
      ]);
      if(!result[8].meta.changes)return json({error:'प्रोफ़ाइल बदल गई है। पेज फिर खोलें।'},409);
      return json({ok:true,deleted:true,cleanupPending:!await flushPhotoCleanup(row.id)});
    }
    if(body.action==='update'){
      const input=body.profile;
      if(!input||typeof input!=='object'||Array.isArray(input)||'aadhaar' in input||'aadhaarNumber' in input)return json({error:'प्रोफ़ाइल की जानकारी जाँचें।'},400);
      const privateData=privateProfileSchema.safeParse(input);
      if(!privateData.success)return json({error:'जन्म तिथि, नियम और वैकल्पिक रेफरेंस जाँचें।'},400);
      const p=privateData.data;
      if(!lock||input.name!==lock.name||p.birthDate!==lock.birth_date||p.aadhaarLast4!==lock.aadhaar_last4||normalizeMobile(input.mobile)!==contact?.mobile)return json({error:'नाम, जन्म तिथि, पहचान और संपर्क मोबाइल बदलवाने के लिए Admin से संपर्क करें।'},409);
      const parsed=validateProfile({...input,age:ageFromDate(p.birthDate)});
      if(!parsed.success||!validLocation(parsed.data)||new Set(p.references.map(r=>r.phone)).size!==p.references.length)return json({error:'स्थान, परिचय, उम्र और रेफरेंस की जानकारी जाँचें।'},400);
      if(!lock||parsed.data.name!==lock.name||p.birthDate!==lock.birth_date||p.aadhaarLast4!==lock.aadhaar_last4||normalizeMobile(input.mobile)!==contact?.mobile)return json({error:'नाम, जन्म तिथि और संपर्क मोबाइल बदलवाने के लिए Admin से संपर्क करें।'},409);
      if(body.revision!==row.updated_at)return json({error:'प्रोफ़ाइल बदल चुकी है। पेज फिर खोलकर बदलाव करें।'},409);
      const keep=body.keepPhotos;
      if(!Array.isArray(keep)||keep.some(k=>typeof k!=='string'||!photos.results.some(p=>p.key===k))||new Set(keep).size!==keep.length)return json({error:'रखने वाली फोटो जाँचें।'},400);
      const files=form?.getAll('photo')??[];
      if(keep.length+files.length>5||files.some(f=>typeof f==='string'))return json({error:'कुल अधिकतम पाँच फोटो रख सकते हैं।'},400);
      const sanitized=await Promise.all(files.map(async f=>sanitizePhoto(await (f as File).arrayBuffer())));
      for(const photo of sanitized){const key=crypto.randomUUID();uploaded.push(key);await bucket().put(key,photo.bytes);}
      const keys=[...keep,...uploaded],reviewToken=crypto.randomUUID();
      const {consent,...details}=parsed.data;
      const updated={...data,...details,approvalStatus:'pending',reviewToken,reviewReason:'',referenceCount:p.references.length,consentAt:now};
      // Visibility is changed separately; content edits always require fresh moderation.
      const success="EXISTS(SELECT 1 FROM profiles WHERE id=? AND owner=? AND json_extract(data,'$.reviewToken')=?)";
      const check=[row.id,row.owner,reviewToken];
      const result=await db().batch([
        db().prepare('UPDATE profiles SET data=?,photo_key=?,updated_at=? WHERE id=? AND owner=? AND updated_at=? AND data=? AND expires_at>? AND EXISTS(SELECT 1 FROM submission_access WHERE owner=? AND token_hash=? AND expires_at>?)').bind(JSON.stringify(updated),keys[0]??null,Math.max(now,row.updated_at+1),row.id,row.owner,row.updated_at,row.data,now,row.owner,row.hash,now),
        db().prepare(`UPDATE profile_private SET references_json=? WHERE owner=? AND ${success}`).bind(JSON.stringify(p.references),row.owner,...check),
        ...photos.results.filter(p=>!keep.includes(p.key)).map(p=>db().prepare(`INSERT OR IGNORE INTO photo_cleanup(key,profile_id,created_at) SELECT ?,?,? WHERE ${success}`).bind(p.key,row.id,now,...check)),
        db().prepare(`DELETE FROM profile_photos WHERE profile_id=? AND ${success}`).bind(row.id,...check),
        ...keys.map((key,slot)=>db().prepare(`INSERT INTO profile_photos(profile_id,slot,key) SELECT ?,?,? WHERE ${success}`).bind(row.id,slot,key,...check)),
      ]);
      if(!result[0].meta.changes)return json({error:'प्रोफ़ाइल बदल गई है। पेज फिर खोलें।'},409);
      committed=true;await flushPhotoCleanup(row.id);
      return json({ok:true,approvalStatus:'pending'});
    }
    if(body.action!==undefined&&body.action!=='read')return json({error:'अमान्य कार्रवाई।'},400);
    const privateRow=await db().prepare('SELECT references_json FROM profile_private WHERE owner=?').bind(row.owner).first<{references_json:string}>();
    return json({ok:true,profileId:row.id,revision:row.updated_at,expiresAt:row.expires_at,publicListing:data.publicListing===true,approvalStatus:data.approvalStatus??'approved',reviewReason:data.reviewReason??'',profile:{...Object.fromEntries(['name','gender','community','gotra','city','country','state','district','education','profession','height','maritalStatus','about','managedBy','language','email'].map(k=>[k,data[k]??''])),birthDate:lock?.birth_date,aadhaarLast4:lock?.aadhaar_last4??'',mobile:contact?.mobile,references:JSON.parse(privateRow?.references_json??'[]')},photos:photos.results});
  }catch(error){if(error instanceof SyntaxError||(error as Error).message==='invalid-input')return json({error:'जानकारी जाँचें और फिर प्रयास करें।'},400);return errorResponse(error);}
  finally{if(!committed&&uploaded.length)await bucket().delete(uploaded).catch(()=>console.error('Submission upload cleanup pending'));}
}
