import {adminIdentity} from '@/lib/admin';
import {db,identity,json,errorResponse,validOrigin,fromRow} from '@/lib/store';
import {deleteStoredProfile,flushPhotoCleanup} from '@/lib/profile-deletion';
import {z} from 'zod';
async function authorization(){if(!await identity())return json({error:'Sign in required'},401);if(!await adminIdentity())return json({error:'Administrator access required'},403);return null;}
export async function GET(request:Request){
  const denied=await authorization();if(denied)return denied;
  try{
    const url=new URL(request.url),query=(url.searchParams.get('q')??'').trim();if(query.length>80)return json({error:'Search must be under 80 characters'},400);
    let cursor:{time:number;id:string}|null=null;
    const before=url.searchParams.get('before');if(before){try{cursor=z.object({time:z.number().int().nonnegative(),id:z.string().uuid()}).parse(JSON.parse(before));}catch{return json({error:'Invalid page cursor'},400);}}
    const match="(instr(lower(json_extract(data,'$.name')),lower(?))>0 OR instr(lower(json_extract(data,'$.city')),lower(?))>0 OR id=?)";
    const rows=await db().prepare('SELECT id,data,photo_key,updated_at FROM profiles WHERE '+match+(cursor?' AND (updated_at<? OR (updated_at=? AND id<?))':'')+' ORDER BY updated_at DESC,id DESC LIMIT 31').bind(query,query,query,...(cursor?[cursor.time,cursor.time,cursor.id]:[])).all<{id:string;data:string;photo_key:string|null;updated_at:number}>();
    const count=await db().prepare('SELECT COUNT(*) AS n FROM profiles WHERE '+match).bind(query,query,query).first<{n:number}>();
    const cleanup=await db().prepare('SELECT COUNT(*) AS n FROM photo_cleanup').first<{n:number}>();const page=rows.results.slice(0,30),last=page.at(-1);
    return json({profiles:page.map(p=>({...fromRow(p),updatedAt:p.updated_at})),total:count?.n??0,pendingPhotoCleanup:cleanup?.n??0,nextCursor:rows.results.length>30&&last?JSON.stringify({time:last.updated_at,id:last.id}):null});
  }catch(e){return errorResponse(e);}
}
export async function DELETE(request:Request){
  const denied=await authorization();if(denied)return denied;if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  try{
    const parsed=z.object({id:z.string().uuid(),confirmation:z.string().trim().min(2).max(80),reason:z.string().trim().min(10).max(1000)}).safeParse(await request.json());if(!parsed.success)return json({error:'Confirm the profile name and give a reason of at least 10 characters. / प्रोफ़ाइल का नाम और कम से कम 10 अक्षरों का कारण दें।'},400);
    const profile=await db().prepare('SELECT data FROM profiles WHERE id=?').bind(parsed.data.id).first<{data:string}>();if(!profile)return json({error:'Profile no longer exists'},404);
    if(JSON.parse(profile.data).name!==parsed.data.confirmation)return json({error:'The confirmation name does not match. / नाम मेल नहीं खाता।'},400);
    const admin=(await adminIdentity())!;
    const result=await deleteStoredProfile(parsed.data.id,{actor:admin.userId,reason:parsed.data.reason});return json({ok:true,...result});
  }catch(e){return errorResponse(e);}
}
export async function PATCH(request:Request){
  const denied=await authorization();if(denied)return denied;if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  try{const cleaned=await flushPhotoCleanup();return json({ok:cleaned});}catch(e){return errorResponse(e);}
}
