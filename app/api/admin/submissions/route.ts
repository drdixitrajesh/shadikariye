import {db,json,errorResponse,validOrigin} from '@/lib/store';
import {adminIdentity} from '@/lib/admin';
import {isPortal,readBody,randomToken,digest} from '@/lib/portal-auth';
export async function GET(){
  if(!isPortal()||!await adminIdentity())return json({error:'Administrator verification required'},403);
  try{
    const rows=await db().prepare("SELECT r.owner,r.requested_at AS requestedAt,c.mobile,p.id AS profileId,json_extract(p.data,'$.name') AS name FROM submission_recovery_requests r JOIN profiles p ON p.owner=r.owner JOIN submission_contacts c ON c.owner=r.owner JOIN portal_accounts a ON a.id=r.owner WHERE r.resolved_at IS NULL AND p.expires_at>? AND a.role='member' AND a.status='invited' AND a.password_hash IS NULL ORDER BY r.requested_at LIMIT 100").bind(Date.now()).all();
    return json({requests:rows.results});
  }catch(error){return errorResponse(error);}
}
export async function POST(request:Request){
  if(!isPortal())return json({error:'Unavailable'},404);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  const admin=await adminIdentity();if(!admin)return json({error:'Administrator verification required'},403);
  try{
    const body=await readBody(request),reason=typeof body.reason==='string'?body.reason.trim():'';
    if(typeof body.owner!=='string'||!/^[0-9a-f-]{36}$/.test(body.owner)||body.identityConfirmed!==true||reason.length<10||reason.length>1000)return json({error:'मूल संपर्क से स्वतंत्र पहचान की पुष्टि करें और 10–1000 अक्षरों का कारण दें। केवल अनुरोध में लिखे नंबर को प्रमाण न मानें।'},400);
    const token=randomToken(),hash=await digest(token),now=Date.now();
    const result=await db().batch([
      db().prepare("INSERT INTO submission_access(owner,token_hash,expires_at) SELECT p.owner,?,p.expires_at FROM profiles p JOIN portal_accounts a ON a.id=p.owner JOIN submission_contacts c ON c.owner=p.owner WHERE p.owner=? AND p.expires_at>? AND a.role='member' AND a.status='invited' AND a.password_hash IS NULL ON CONFLICT(owner) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at").bind(hash,body.owner,now),
      db().prepare('UPDATE submission_recovery_requests SET resolved_at=?,reviewed_by=? WHERE owner=? AND EXISTS(SELECT 1 FROM submission_access WHERE owner=? AND token_hash=?)').bind(now,admin.userId,body.owner,body.owner,hash),
      db().prepare("INSERT INTO admin_actions(id,actor,target,action,reason,created_at) SELECT ?,?,?,'recover_submission',?,? WHERE EXISTS(SELECT 1 FROM submission_access WHERE owner=? AND token_hash=?)").bind(crypto.randomUUID(),admin.userId,body.owner,reason,now,body.owner,hash),
    ]);
    if(!result[0].meta.changes)return json({error:'यह पोस्ट उपलब्ध नहीं है या खाते से जुड़ चुकी है।'},404);
    return json({ok:true,managementUrl:new URL('/post/privacy#'+token,request.url).href});
  }catch(error){if(error instanceof SyntaxError||(error as Error).message==='invalid-input')return json({error:'जानकारी जाँचें।'},400);return errorResponse(error);}
}
