import {approvedSql} from '@/lib/profile-approval';
import {db,identity,json,errorResponse,validOrigin} from '@/lib/store';
import {z} from 'zod';
import {blocked,requireVerified} from '@/lib/security';
async function allowed(thread:string,owner:string){const row=await db().prepare('SELECT i.id,i.target,i.sender_profile FROM interests i JOIN profiles p ON p.id=i.target JOIN profiles s ON s.id=i.sender_profile WHERE '+approvedSql('p')+' AND '+approvedSql('s')+' AND i.id=? AND i.status=\'accepted\' AND (i.sender=? OR p.owner=?)').bind(thread,owner,owner).first<{id:string;target:string;sender_profile:string}>();if(!row||await blocked(owner,row.target)||await blocked(owner,row.sender_profile))return null;return row;}
export async function GET(request:Request){
  const owner=await identity();if(!owner)return json({error:'Sign in required'},401);
  const url=new URL(request.url),thread=url.searchParams.get('thread')??'';
  if(!z.string().uuid().safeParse(thread).success)return json({error:'Invalid conversation'},400);
  const before=url.searchParams.get('before'),beforeId=url.searchParams.get('beforeId');
  if(before!==null&&(!Number.isSafeInteger(Number(before))||Number(before)<0||!z.string().uuid().safeParse(beforeId).success))return json({error:'Invalid message cursor'},400);
  try{
    const gate=await requireVerified(owner);if(gate)return gate;
    if(!await allowed(thread,owner))return json({error:'Conversation unavailable'},403);
    const base='SELECT id,sender,body,created_at FROM messages WHERE interest_id=?';
    const query=before===null?db().prepare(base+' ORDER BY created_at DESC,id DESC LIMIT 501').bind(thread):
      db().prepare(base+' AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 501').bind(thread,Number(before),Number(before),beforeId);
    const result=await query.all<{id:string;sender:string;body:string;created_at:number}>();
    return json({messages:result.results.slice(0,500).reverse().map(m=>({id:m.id,body:m.body,created_at:m.created_at,mine:m.sender===owner})),hasMore:result.results.length>500});
  }catch(e){return errorResponse(e);}
}
export async function POST(request:Request){
  const owner=await identity();if(!owner)return json({error:'Sign in required'},401);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  try{
    const gate=await requireVerified(owner);if(gate)return gate;
    const parsed=z.object({thread:z.string().uuid(),body:z.string().trim().min(1).max(2000)}).safeParse(await request.json());if(!parsed.success)return json({error:'Message must contain 1–2000 characters. / संदेश 1–2000 अक्षरों का होना चाहिए।'},400);
    if(!await allowed(parsed.data.thread,owner))return json({error:'Both members must accept the interest before messaging. / संदेश भेजने के लिए रुचि स्वीकार होना आवश्यक है।'},403);
    const id=crypto.randomUUID();const inserted=await db().prepare(`INSERT INTO messages (id,interest_id,sender,body,created_at) SELECT ?,i.id,?,?,? FROM interests i JOIN profiles p ON p.id=i.target JOIN profiles s ON s.id=i.sender_profile WHERE ${approvedSql('p')} AND ${approvedSql('s')} AND i.id=? AND i.status='accepted' AND (i.sender=? OR p.owner=?) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.owner=i.sender AND b.target=i.target) OR (b.owner=p.owner AND b.target=i.sender_profile))`).bind(id,owner,parsed.data.body,Date.now(),parsed.data.thread,owner,owner).run();
    if(!inserted.meta.changes)return json({error:'Conversation unavailable'},403);
    return json({ok:true,id});
  }catch(e){return errorResponse(e);}
}
