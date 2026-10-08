import {db,identity,json,validOrigin,errorResponse,findProfile} from '@/lib/store';
import {z} from 'zod';
export async function POST(request:Request){
  const owner=await identity();if(!owner)return json({error:'Sign in required'},401);if(!validOrigin(request))return json({error:'Invalid origin'},403);
  try{
    const body=z.object({target:z.string().uuid(),kind:z.enum(['block','report']),reason:z.string().trim().min(10).max(1000).optional()}).safeParse(await request.json());if(!body.success)return json({error:'शिकायत में कम से कम 10 अक्षर दें। / Explain the concern in at least 10 characters.'},400);
    const {target,kind,reason}=body.data;if(!await findProfile(target))return json({error:'Profile unavailable'},404);
    const own=await db().prepare('SELECT id FROM profiles WHERE owner=?').bind(owner).first<{id:string}>();if(own?.id===target)return json({error:'Choose another profile'},400);
    if(kind==='report'){
      if(!reason)return json({error:'Report reason required'},400);
      const count=await db().prepare('SELECT COUNT(*) n FROM reports WHERE owner=? AND created_at>?').bind(owner,Date.now()-86400000).first<{n:number}>();if((count?.n??0)>=10)return json({error:'Daily report limit reached'},429);
      await db().prepare('INSERT INTO reports (id,owner,target,reason,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),owner,target,reason,Date.now()).run();
    }
    await db().batch([db().prepare('INSERT OR IGNORE INTO blocks (owner,target,created_at) VALUES (?,?,?)').bind(owner,target,Date.now()),db().prepare("UPDATE interests SET status='ended' WHERE (sender=? AND target=?) OR (sender IN (SELECT owner FROM profiles WHERE id=?) AND target IN (SELECT id FROM profiles WHERE owner=?))").bind(owner,target,target,owner)]);
    return json({ok:true,reviewStatus:kind==='report'?'pending':null});
  }catch(e){return errorResponse(e);}
}
