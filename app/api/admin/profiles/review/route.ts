import {adminIdentity} from '@/lib/admin';
import {db,identity,json,errorResponse,validOrigin} from '@/lib/store';
import {z} from 'zod';

export async function POST(request:Request){
  if(!await identity())return json({error:'Sign in required'},401);
  const admin=await adminIdentity();
  if(!admin)return json({error:'Administrator access required'},403);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  try{
    const parsed=z.object({id:z.string().uuid(),reviewToken:z.string().max(80),decision:z.enum(['approved','rejected']),reason:z.string().trim().max(1000).default('')}).safeParse(await request.json());
    if(!parsed.success)return json({error:'Invalid review'},400);
    const {id,reviewToken,decision,reason}=parsed.data;
    if(decision==='rejected'&&reason.length<10)return json({error:'अस्वीकृति का कारण कम से कम 10 अक्षरों में लिखें। / Give a rejection reason of at least 10 characters.'},400);
    const now=Date.now();
    const condition="id=? AND coalesce(json_extract(data,'$.reviewToken'),'')=? AND expires_at>?";
    const nextToken=crypto.randomUUID();
    const result=await db().batch([
      db().prepare("INSERT INTO admin_actions(id,actor,target,action,reason,created_at) SELECT ?,?,id,?,?,? FROM profiles WHERE "+condition).bind(crypto.randomUUID(),admin.userId,decision==='approved'?'approve_profile':'reject_profile',reason||'Profile reviewed and approved',now,id,reviewToken,now),
      db().prepare("UPDATE profiles SET data=json_set(data,'$.approvalStatus',?,'$.reviewReason',?,'$.reviewedAt',?,'$.reviewToken',?) WHERE "+condition).bind(decision,reason,now,nextToken,id,reviewToken,now),
    ]);
    if(!result[1].meta.changes)return json({error:'पोस्ट बदल गई है या उसकी अवधि पूरी है। ताज़ा प्रीव्यू देखकर फिर निर्णय लें। / Profile changed or expired. Reload its preview before reviewing.'},409);
    return json({ok:true,approvalStatus:decision});
  }catch(e){return errorResponse(e);}
}
