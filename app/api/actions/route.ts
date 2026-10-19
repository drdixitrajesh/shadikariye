import {approvedSql} from '@/lib/profile-approval';
import {db,identity,json,errorResponse,validOrigin,findProfile} from '@/lib/store';
import {z} from 'zod';
import {requireVerified,blocked,hasView} from '@/lib/security';
const actionSchema=z.object({kind:z.enum(['save','interest']),target:z.string().min(1).max(80),saved:z.boolean().optional(),message:z.string().trim().max(1000).optional()});
export async function POST(request:Request){
  const owner=await identity();if(!owner)return json({error:'Sign in to continue. / जारी रखने के लिए साइन इन करें।'},401);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  try{
    const body=actionSchema.safeParse(await request.json());if(!body.success)return json({error:'Invalid action'},400);
    const {kind,target,saved,message}=body.data;
    if(!target.startsWith('demo-')){const gate=await requireVerified(owner);if(gate)return gate;if(await blocked(owner,target))return json({error:'Profile unavailable'},403);if(!await hasView(owner,target))return json({error:'यह प्रोफ़ाइल आज की सीमा में उपलब्ध नहीं है। / Profile is not in your daily allowance.'},403);}
    const targetProfile=await findProfile(target);if(!targetProfile)return json({error:'This profile is no longer available. / यह प्रोफ़ाइल अब उपलब्ध नहीं है।'},404);
    const own=await db().prepare('SELECT id FROM profiles WHERE owner=?').bind(owner).first<{id:string}>();
    if(own?.id===target)return json({error:'Choose another profile. / दूसरी प्रोफ़ाइल चुनें।'},400);
    if(kind==='save'){
      if(saved)await db().prepare('INSERT INTO saved_profiles (owner,target,created_at) VALUES (?,?,?) ON CONFLICT(owner,target) DO NOTHING').bind(owner,target,Date.now()).run();
      else await db().prepare('DELETE FROM saved_profiles WHERE owner=? AND target=?').bind(owner,target).run();
      return json({ok:true});
    }
    if(targetProfile.demo)return json({error:'This is a fictional demo profile. Interests are available for real members. / यह काल्पनिक डेमो प्रोफ़ाइल है। रियल सदस्यों को रुचि भेज सकते हैं।'},422);
    if(own&&!await db().prepare('SELECT 1 FROM profiles WHERE id=? AND '+approvedSql()).bind(own.id).first())return json({error:'Admin approval is required before sending interests. / रुचि भेजने से पहले Admin approval आवश्यक है।'},409);
    if(!own)return json({error:'Create your profile first. / पहले अपनी प्रोफ़ाइल बनाएं।'},409);
    const count=await db().prepare('SELECT COUNT(*) AS n FROM interests WHERE sender=? AND created_at>?').bind(owner,Date.now()-86400000).first<{n:number}>();
    if((count?.n??0)>=20)return json({error:'You can send 20 interests per day. Try again tomorrow. / एक दिन में 20 रुचियाँ भेज सकते हैं। कल फिर कोशिश करें।'},429);
    const existing=await db().prepare('SELECT id FROM interests WHERE sender=? AND target=?').bind(owner,target).first();
    if(existing)return json({error:'You have already sent an interest. / आप पहले ही रुचि भेज चुके हैं।'},409);
    const inserted=await db().prepare(`INSERT INTO interests (id,sender,sender_profile,target,message,status,created_at) SELECT ?,?,?,p.id,?,'pending',? FROM profiles p WHERE ${approvedSql('p')} AND p.id=? AND EXISTS (SELECT 1 FROM profiles WHERE ${approvedSql()} AND id=? AND owner=?) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.owner=? AND b.target=p.id) OR (b.owner=p.owner AND b.target=?))`).bind(crypto.randomUUID(),owner,own.id,message??'I would like to get to know you. / मैं आपसे परिचय करना चाहता/चाहती हूँ।',Date.now(),target,own.id,owner,owner,own.id).run();
    if(!inserted.meta.changes)return json({error:'Profile unavailable'},403);
    return json({ok:true});
  }catch(e){return errorResponse(e);}
}
export async function PATCH(request:Request){
  const owner=await identity();if(!owner)return json({error:'Sign in required'},401);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  try{
    const body=z.object({id:z.string().uuid(),status:z.enum(['accepted','declined','ended'])}).safeParse(await request.json());
    if(!body.success)return json({error:'Invalid response'},400);
    const gate=await requireVerified(owner);if(gate)return gate;
    const result=body.data.status==='ended'
      ?await db().prepare('UPDATE interests SET status=? WHERE id=? AND status=\'accepted\' AND (sender=? OR target IN (SELECT id FROM profiles WHERE owner=?))').bind('ended',body.data.id,owner,owner).run()
      :await db().prepare('UPDATE interests SET status=? WHERE id=? AND status=\'pending\' AND target IN (SELECT id FROM profiles WHERE owner=?)').bind(body.data.status,body.data.id,owner).run();
    if(!result.meta.changes)return json({error:'This interest cannot be updated. / यह रुचि अपडेट नहीं हो सकती।'},404);
    return json({ok:true});
  }catch(e){return errorResponse(e);}
}
