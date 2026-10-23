import {isPortal} from '@/lib/portal-auth';
import {portalUser} from '@/lib/portal-context';
import {sixMonthsAfter} from '@/lib/profile-expiry';
import {validLocation} from '@/lib/location-validation';
import {validateProfile} from '@/lib/matrimony';
import {z} from 'zod';
import {deleteStoredProfile} from '@/lib/profile-deletion';
import {ageFromDate,validBirthDate,requireVerified} from '@/lib/security';
import {db,identity,json,errorResponse,validOrigin,fromRow} from '@/lib/store';
const privateSchema=z.object({birthDate:z.string().refine(validBirthDate),aadhaarLast4:z.string().regex(/^([0-9]{4})?$/),references:z.array(z.object({name:z.string().trim().min(2).max(80),relationship:z.string().trim().min(2).max(80),phone:z.string().regex(/^\+91[6-9]\d{9}$/),consent:z.literal(true)})).length(2),termsAccepted:z.literal(true)});
export async function POST(request:Request){
  const owner=await identity();if(!owner)return json({error:'Sign in required'},401);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  try{
    const body=await request.json() as Record<string,unknown>;
    if('aadhaar' in body||'aadhaarNumber' in body)return json({error:'पूरा आधार नंबर नहीं भेजें। / Do not submit a full Aadhaar number.'},400);
    const privateData=privateSchema.safeParse(body);
    if(!privateData.success)return json({error:'जन्म तिथि, दो सहमति वाले रेफरेंस और नियमों की स्वीकृति आवश्यक हैं। / Birth date, two consenting references and acceptance of terms are required.'},400);
    const p=privateData.data;
    if(p.references[0].phone===p.references[1].phone)return json({error:'दो अलग रेफरेंस दें। / Provide two different references.'},400);
    const parsed=validateProfile({...body,age:ageFromDate(p.birthDate)});
    if(!parsed.success)return json({error:'प्रोफ़ाइल की जानकारी और प्रकाशन की सहमति जाँचें। / Check profile details and publication consent.'},400);
    if(!validLocation(parsed.data))return json({error:'देश, राज्य और ज़िले का चयन जाँचें। / Check the selected country, state and district.'},400);
    const gate=await requireVerified(owner);if(gate)return gate;
    const old=await db().prepare('SELECT id,data,photo_key,published_at,expires_at FROM profiles WHERE owner=?').bind(owner).first<{id:string;data:string;photo_key:string|null;published_at:number;expires_at:number}>();
    if(body.publicationToken!==undefined&&(!old||body.publicationToken!==old.published_at))return json({error:'पोस्ट हट चुकी है या बदल गई है। पेज रिफ्रेश करें। / Publication no longer exists. Refresh before creating a new post.'},409);
    const lock=await db().prepare('SELECT profile_id,name,birth_date,aadhaar_last4 FROM identity_locks WHERE owner=?').bind(owner).first<{profile_id:string;name:string;birth_date:string;aadhaar_last4:string}>();
    if(lock&&(lock.name!==parsed.data.name||lock.birth_date!==p.birthDate||lock.aadhaar_last4!==p.aadhaarLast4))return json({error:'नाम, जन्म तिथि और पहचान के अंतिम चार अंक स्थायी हैं। सुधार हेतु प्रशासक से संपर्क करें। / Name, birth date and identity suffix are locked.'},409);
    if(!lock&&old&&fromRow(old).name!==parsed.data.name)return json({error:'पुरानी प्रोफ़ाइल का नाम बदल नहीं सकते। / The existing profile name is locked.'},409);
    const id=old?.id??(lock?.profile_id||crypto.randomUUID());const {consent,...details}=parsed.data;
    const publishedAt=Date.now();
    if(body.publicListing!==undefined&&typeof body.publicListing!=='boolean')return json({error:'Choose whether your profile may be public.'},400);
    const previous=old?JSON.parse(old.data):{};
    const publicListing=isPortal()&&portalUser()?.testAccount!==true&&(body.publicListing===undefined?previous.publicListing===true:body.publicListing===true);
    const writes=await db().batch([
      db().prepare('INSERT OR IGNORE INTO identity_locks (owner,profile_id,name,birth_date,aadhaar_last4,created_at) VALUES (?,?,?,?,?,?)').bind(owner,id,details.name,p.birthDate,p.aadhaarLast4,publishedAt),
      db().prepare('INSERT INTO profiles (id,owner,data,photo_key,updated_at,published_at,expires_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM identity_locks WHERE owner=? AND name=? AND birth_date=? AND aadhaar_last4=? AND profile_id=?) AND ((?=0 AND NOT EXISTS (SELECT 1 FROM profiles WHERE owner=?)) OR EXISTS (SELECT 1 FROM profiles WHERE owner=? AND id=? AND published_at=? AND expires_at>?)) ON CONFLICT(owner) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(id,owner,JSON.stringify({...details,approvalStatus:'pending',reviewToken:crypto.randomUUID(),publicListing,publicListingConsentAt:publicListing?(previous.publicListingConsentAt??publishedAt):undefined,...(isPortal()?{testAccount:portalUser()?.testAccount===true,portrait:old?JSON.parse(old.data).portrait??null:null}:{}),referenceCount:2,termsVersion:'2026-10-18',consentAt:publishedAt}),old?.photo_key??null,publishedAt,publishedAt,sixMonthsAfter(publishedAt),owner,details.name,p.birthDate,p.aadhaarLast4,id,old?1:0,owner,owner,id,old?.published_at??0,publishedAt),
      db().prepare('INSERT INTO profile_private (owner,references_json) SELECT ?,? WHERE EXISTS (SELECT 1 FROM identity_locks WHERE owner=? AND name=? AND birth_date=? AND aadhaar_last4=? AND profile_id=?) AND EXISTS (SELECT 1 FROM profiles WHERE owner=? AND id=? AND published_at=? AND expires_at>?) ON CONFLICT(owner) DO UPDATE SET references_json=excluded.references_json').bind(owner,JSON.stringify(p.references),owner,details.name,p.birthDate,p.aadhaarLast4,id,owner,id,old?.published_at??publishedAt,publishedAt),
    ]);
    if(!writes[1]?.meta.changes)return json({error:'पोस्ट हट चुकी है या बदल गई है। पेज रिफ्रेश करें। / Publication changed during request. Refresh and retry.'},409);
    const saved=await db().prepare('SELECT id,data,photo_key,published_at,expires_at FROM profiles WHERE owner=?').bind(owner).first<{id:string;data:string;photo_key:string|null;published_at:number;expires_at:number}>();
    const finalLock=await db().prepare('SELECT profile_id,name,birth_date,aadhaar_last4 FROM identity_locks WHERE owner=?').bind(owner).first<{profile_id:string;name:string;birth_date:string;aadhaar_last4:string}>();
    if(!saved||saved.published_at!==(old?.published_at??publishedAt)||!finalLock||finalLock.name!==details.name||finalLock.birth_date!==p.birthDate||finalLock.aadhaar_last4!==p.aadhaarLast4||finalLock.profile_id!==id)return json({error:'Identity changed during request. Retry.'},409);
    return json({profile:fromRow(saved)});
  }catch(e){return errorResponse(e);}
}
export async function DELETE(request:Request){
  const owner=await identity();if(!owner)return json({error:'Sign in required'},401);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  try{
    const p=await db().prepare('SELECT id,photo_key FROM profiles WHERE owner=?').bind(owner).first<{id:string;photo_key:string|null}>();
    if(!p)return json({ok:true});
    const result=await deleteStoredProfile(p.id);
    return json({ok:true,...result});
  }catch(e){return errorResponse(e);}
}
