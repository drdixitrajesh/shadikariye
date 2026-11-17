import {db,json,errorResponse,validOrigin} from '@/lib/store';
import {isPortal,readBody,throttle,turnstile} from '@/lib/portal-auth';
import {normalizeMobile} from '@/lib/account-contact';
export async function POST(request:Request){
  if(!isPortal())return json({error:'Unavailable'},404);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  try{
    const body=await readBody(request),mobile=normalizeMobile(body.mobile);
    if(!mobile||(body.profileId!==undefined&&body.profileId!==''&&(typeof body.profileId!=='string'||!/^[0-9a-f-]{36}$/.test(body.profileId))))return json({error:'सही संपर्क मोबाइल और उपलब्ध हो तो पोस्ट ID दें।'},400);
    if(!await throttle(request,'submission-recovery',mobile,{ip:5,subject:3,global:80}))return json({error:'15 मिनट बाद प्रयास करें।'},429);
    if(!await turnstile(body.turnstile,'recover',new URL(request.url).hostname))return json({error:'सुरक्षा जाँच पूरी करें।'},403);
    const now=Date.now();
    await db().prepare("INSERT INTO submission_recovery_requests(owner,requested_at) SELECT p.owner,? FROM submission_contacts c JOIN profiles p ON p.owner=c.owner JOIN portal_accounts a ON a.id=p.owner WHERE c.mobile=? AND (?='' OR p.id=?) AND p.expires_at>? AND a.role='member' AND a.status='invited' AND a.password_hash IS NULL ON CONFLICT(owner) DO UPDATE SET requested_at=excluded.requested_at,resolved_at=NULL,reviewed_by=NULL").bind(now,mobile,body.profileId??'',body.profileId??'',now).run();
    return json({ok:true,message:'यदि जानकारी किसी सक्रिय पोस्ट से मेल खाती है तो सहायता अनुरोध दर्ज हो गया है। Admin 9131591131 से संपर्क करें। मूल संपर्क से पहचान की पुष्टि के बाद नया निजी लिंक मिलेगा। SMS या OTP अपने आप नहीं भेजा जाएगा।'},202);
  }catch(error){if(error instanceof SyntaxError||(error as Error).message==='invalid-input')return json({error:'जानकारी जाँचें।'},400);return errorResponse(error);}
}
