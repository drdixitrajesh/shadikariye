import {db,json,errorResponse,validOrigin} from '@/lib/store';
import {adminIdentity} from '@/lib/admin';
import {isPortal,publicRegistration,throttle,turnstile,randomToken,digest} from '@/lib/portal-auth';
import {privateProfileSchema} from '@/lib/profile-input';
import {validateProfile} from '@/lib/matrimony';
import {ageFromDate} from '@/lib/security';
import {validLocation} from '@/lib/location-validation';
import {normalizeMobile} from '@/lib/account-contact';
import {sixMonthsAfter} from '@/lib/profile-expiry';
import {createPhotoStore,sanitizePhoto,PhotoValidationError,PhotoQuotaError} from '@/lib/portal-photos';

export async function POST(request:Request){
  if(!isPortal())return json({error:'Posting unavailable'},404);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  const admin=await adminIdentity();
  if(!admin&&!publicRegistration())return json({error:'Posting unavailable'},404);
  const photoKeys:string[]=[];
  let committed=false;
  try{
    if(!admin&&!await throttle(request,'post','all',{ip:5,subject:80,global:80}))return json({error:'कृपया 15 मिनट बाद प्रयास करें। / Please wait 15 minutes.'},429);
    const form=await request.formData();
    const body=JSON.parse(String(form.get('details')??'{}')) as Record<string,unknown>;
    if(!admin&&!await turnstile(body.turnstile,'post',new URL(request.url).hostname))return json({error:'सुरक्षा जाँच पूरी करें और फिर प्रयास करें। / Complete the security check.'},403);
    if('aadhaar' in body||'aadhaarNumber' in body)return json({error:'पूरा आधार नंबर न दें।'},400);
    const privateData=privateProfileSchema.safeParse(body);
    if(!privateData.success)return json({error:'जन्म तिथि, नियम और वैकल्पिक रेफरेंस की जानकारी जाँचें।'},400);
    if(new Set(privateData.data.references.map(r=>r.phone)).size!==privateData.data.references.length)return json({error:'दो अलग रेफरेंस दें।'},400);
    const mobile=normalizeMobile(body.mobile);
    if(!mobile)return json({error:'भारत का सही 10 अंकों वाला संपर्क मोबाइल नंबर दें।'},400);
    const parsed=validateProfile({...body,age:ageFromDate(privateData.data.birthDate)});
    if(!parsed.success||!validLocation(parsed.data))return json({error:'नाम, जन्म तिथि, स्थान, पढ़ाई, पेशा और अपना परिचय जाँचें। वर के 21 वर्ष और वधू के 18 वर्ष पूरे होना आवश्यक है; अधिकतम उम्र 70 वर्ष है।'},400);
    // Guest contact details never select or overwrite an existing login account.
    const files=form.getAll('photo');
    if(files.length>5||files.some(f=>typeof f==='string'))return json({error:'अधिकतम पाँच फोटो दें।'},400);
    const photos=await Promise.all(files.map(async file=>sanitizePhoto(await (file as File).arrayBuffer())));
    const owner=crypto.randomUUID(),id=crypto.randomUUID(),now=Date.now();
    const {consent,...details}=parsed.data;
    if(body.publicListing!==undefined&&typeof body.publicListing!=='boolean')return json({error:'सार्वजनिक दिखाने का विकल्प जाँचें।'},400);
    const managementToken=randomToken(),tokenHash=await digest(managementToken);
    const data={...details,approvalStatus:admin?'approved':'pending',reviewToken:crypto.randomUUID(),publicListing:body.publicListing===true,publicListingConsentAt:body.publicListing===true?now:undefined,referenceCount:privateData.data.references.length,termsVersion:'2026-11-15',consentAt:now,submissionSource:admin?'admin':'guest',submittedBy:admin?.userId};
    const store=createPhotoStore(db());
    for(const photo of photos){const key=crypto.randomUUID();photoKeys.push(key);await store.put(key,photo.bytes);}
    // The submission has a separate invited record, no password/session and no
    // account-mobile reservation. The contact is private in profile_private.
    await db().batch([
      db().prepare("INSERT INTO portal_accounts(id,username,role,status,test_account,created_at) VALUES(?,?,'member','invited',0,?)").bind(owner,'post.'+owner,now),
      db().prepare('INSERT INTO identity_locks(owner,profile_id,name,birth_date,aadhaar_last4,created_at) VALUES(?,?,?,?,?,?)').bind(owner,id,details.name,privateData.data.birthDate,privateData.data.aadhaarLast4,now),
      db().prepare('INSERT INTO profiles(id,owner,data,photo_key,updated_at,published_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(id,owner,JSON.stringify(data),photoKeys[0]??null,now,now,sixMonthsAfter(now)),
      db().prepare('INSERT INTO profile_private(owner,references_json) VALUES(?,?)').bind(owner,JSON.stringify(privateData.data.references)),
      db().prepare('INSERT INTO submission_access(owner,token_hash,expires_at) VALUES(?,?,?)').bind(owner,tokenHash,sixMonthsAfter(now)),
      db().prepare('INSERT INTO submission_contacts(owner,mobile,created_at) VALUES(?,?,?)').bind(owner,mobile,now),
      ...photoKeys.map((key,slot)=>db().prepare('INSERT INTO profile_photos(profile_id,slot,key) VALUES(?,?,?)').bind(id,slot,key)),
      ...(admin?[db().prepare("INSERT INTO admin_actions(id,actor,target,action,reason,created_at) VALUES(?,?,?,'create_profile',?,?)").bind(crypto.randomUUID(),admin.userId,id,'Posted by administrator with publication consent',now)]:[]),
    ]);
    committed=true;
    return json({ok:true,profileId:id,memberId:owner,approvalStatus:data.approvalStatus,managementToken},201);
  }catch(error){if(error instanceof SyntaxError)return json({error:'Invalid submission details'},400);if(error instanceof PhotoValidationError||error instanceof PhotoQuotaError)return json({error:error.message},error.status);return errorResponse(error);}
  finally{if(!committed&&photoKeys.length)await createPhotoStore(db()).delete(photoKeys).catch(()=>console.error('Submission photo cleanup failed'));}
}
