import {db,json,errorResponse,validOrigin} from '@/lib/store';
import {digest,isPortal,readBody,throttle} from '@/lib/portal-auth';

export async function POST(request:Request){
  if(!isPortal())return json({error:'Unavailable'},404);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  try{
    if(!await throttle(request,'submission-privacy','all',{ip:30,subject:160,global:160}))return json({error:'कुछ समय बाद प्रयास करें।'},429);
    const body=await readBody(request);
    if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return json({error:'निजी लिंक अमान्य है या समाप्त हो गया है।'},404);
    if(body.publicListing!==undefined&&typeof body.publicListing!=='boolean')return json({error:'सार्वजनिक दिखाने का विकल्प जाँचें।'},400);
    const hash=await digest(body.token),now=Date.now();
    const row=await db().prepare('SELECT p.id,p.owner,p.data FROM submission_access a JOIN profiles p ON p.owner=a.owner WHERE a.token_hash=? AND a.expires_at>? AND p.expires_at>?').bind(hash,now,now).first<{id:string;owner:string;data:string}>();
    if(!row)return json({error:'निजी लिंक अमान्य है या पोस्ट की अवधि समाप्त हो गई है।'},404);
    if(typeof body.publicListing==='boolean'){
      const result=await db().prepare("UPDATE profiles SET data=json_set(data,'$.publicListing',json(?),'$.publicListingConsentAt',?) WHERE id=? AND owner=? AND expires_at>? AND EXISTS(SELECT 1 FROM submission_access WHERE owner=? AND token_hash=? AND expires_at>?)").bind(body.publicListing?'true':'false',body.publicListing?now:null,row.id,row.owner,now,row.owner,hash,now).run();
      if(!result.meta.changes)return json({error:'पोस्ट उपलब्ध नहीं है।'},404);
    }
    const current=await db().prepare('SELECT data FROM profiles WHERE id=?').bind(row.id).first<{data:string}>();
    if(!current)return json({error:'पोस्ट उपलब्ध नहीं है।'},404);
    const data=JSON.parse(current.data);
    return json({ok:true,publicListing:data.publicListing===true,approvalStatus:data.approvalStatus??'approved'});
  }catch(error){return errorResponse(error);}
}
