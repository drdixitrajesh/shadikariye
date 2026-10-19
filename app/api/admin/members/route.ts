import {adminIdentity} from '@/lib/admin';
import {db,identity,json,errorResponse,fromRow} from '@/lib/store';
import {ageFromDate} from '@/lib/security';
import {isPortal} from '@/lib/portal-auth';
import {z} from 'zod';
export const dynamic='force-dynamic';
type MemberRow={id:string;username:string;status:string;created_at:number;test_account:number;profile_id:string|null;data:string|null;photo_key:string|null;published_at:number|null;expires_at:number|null;updated_at:number|null};
function member(row:MemberRow){return {id:row.id,username:row.username,status:row.status,createdAt:row.created_at,testAccount:Boolean(row.test_account),profile:row.profile_id&&row.data?{id:row.profile_id,name:String(JSON.parse(row.data).name),city:String(JSON.parse(row.data).city),publicListing:JSON.parse(row.data).publicListing===true,approvalStatus:fromRow({id:row.profile_id,data:row.data,photo_key:row.photo_key}).approvalStatus,publishedAt:row.published_at}:null};}
const selection='SELECT a.id,a.username,a.status,a.created_at,a.test_account,p.id AS profile_id,p.data,p.photo_key,p.published_at,p.expires_at,p.updated_at FROM portal_accounts a LEFT JOIN profiles p ON p.owner=a.id';
export async function GET(request:Request){
  if(!await identity())return json({error:'Sign in required'},401);
  if(!await adminIdentity())return json({error:'Administrator access required'},403);
  if(!isPortal())return json({error:'Member accounts are unavailable on this host'},404);
  try{
    const url=new URL(request.url),id=url.searchParams.get('id');
    if(id){
      if(!z.string().uuid().safeParse(id).success)return json({error:'Invalid member ID'},400);
      const row=await db().prepare(selection+" WHERE a.id=? AND a.role='member'").bind(id).first<MemberRow>();
      if(!row)return json({error:'Member not found'},404);
      const profileId=row.profile_id??'';
      const [photos,counts,events,birth]=await Promise.all([
        db().prepare('SELECT slot,key FROM profile_photos WHERE profile_id=? ORDER BY slot').bind(profileId).all<{slot:number;key:string}>(),
        db().prepare('SELECT (SELECT COUNT(*) FROM saved_profiles WHERE owner=?) AS saved,(SELECT COUNT(*) FROM interests WHERE sender=?) AS interestsSent,(SELECT COUNT(*) FROM interests WHERE target=?) AS interestsReceived,(SELECT COUNT(*) FROM messages WHERE sender=?) AS messagesSent,(SELECT COUNT(*) FROM daily_views WHERE owner=?) AS profileViews,(SELECT COUNT(*) FROM reports WHERE target=?) AS reportsReceived').bind(id,id,profileId,id,id,profileId).first(),
        db().prepare("SELECT at,kind,detail FROM (SELECT created_at AS at,'account_created' AS kind,'' AS detail FROM portal_accounts WHERE id=? UNION ALL SELECT published_at,'profile_published','' FROM profiles WHERE owner=? UNION ALL SELECT updated_at,'profile_updated','' FROM profiles WHERE owner=? AND updated_at>published_at UNION ALL SELECT created_at,action,reason FROM admin_actions WHERE target=? UNION ALL SELECT created_at,'interest_sent',status FROM interests WHERE sender=? UNION ALL SELECT created_at,'interest_received',status FROM interests WHERE target=? UNION ALL SELECT created_at,'message_sent','' FROM messages WHERE sender=? UNION ALL SELECT created_at,'profile_saved','' FROM saved_profiles WHERE owner=? UNION ALL SELECT created_at,'report_submitted','' FROM reports WHERE owner=? UNION ALL SELECT created_at,'session_started','' FROM portal_sessions WHERE account_id=?) ORDER BY at DESC LIMIT 30").bind(id,id,id,profileId,id,profileId,id,id,id,id).all(),
        db().prepare('SELECT birth_date FROM identity_locks WHERE owner=?').bind(id).first<{birth_date:string}>(),
      ]);
      const profile=row.profile_id&&row.data?fromRow({id:row.profile_id,data:row.data,photo_key:row.photo_key,published_at:row.published_at??undefined,expires_at:row.expires_at??undefined}):null;
      if(profile){if(birth)profile.age=ageFromDate(birth.birth_date);profile.photoSlots=photos.results;profile.photoKeys=[...new Set([...(row.photo_key?[row.photo_key]:[]),...photos.results.map(p=>p.key)])];}
      return json({member:member(row),profile,updatedAt:row.updated_at,counts,events:events.results});
    }
    const query=(url.searchParams.get('q')??'').trim(),includeTests=url.searchParams.get('tests')==='1',pendingOnly=url.searchParams.get('pending')==='1';
    if(query.length>80)return json({error:'Search must be under 80 characters'},400);
    let cursor:{at:number;id:string}|null=null;
    if(url.searchParams.get('before')){try{cursor=z.object({at:z.number().int().nonnegative(),id:z.string().uuid()}).parse(JSON.parse(url.searchParams.get('before')!));}catch{return json({error:'Invalid page cursor'},400);}}
    const filter=(pendingOnly?" WHERE coalesce(json_extract(p.data,'$.approvalStatus'),'approved')='pending' AND ":" WHERE ")+" a.role='member' AND (?=1 OR a.test_account=0) AND (instr(lower(a.username),lower(?))>0 OR instr(lower(coalesce(json_extract(p.data,'$.name'),'')),lower(?))>0 OR instr(lower(coalesce(json_extract(p.data,'$.city'),'')),lower(?))>0)";
    const rows=await db().prepare(selection+filter+(cursor?' AND (a.created_at<? OR (a.created_at=? AND a.id<?))':'')+' ORDER BY a.created_at DESC,a.id DESC LIMIT 31').bind(includeTests?1:0,query,query,query,...(cursor?[cursor.at,cursor.at,cursor.id]:[])).all<MemberRow>();
    const total=await db().prepare('SELECT COUNT(*) AS n FROM portal_accounts a LEFT JOIN profiles p ON p.owner=a.id'+filter).bind(includeTests?1:0,query,query,query).first<{n:number}>();
    const summary=await db().prepare("SELECT (SELECT COUNT(*) FROM portal_accounts WHERE role='member' AND test_account=0) AS members,(SELECT COUNT(*) FROM profiles p JOIN portal_accounts a ON a.id=p.owner WHERE a.role='member' AND a.test_account=0) AS profiles,(SELECT COUNT(*) FROM profiles p JOIN portal_accounts a ON a.id=p.owner WHERE a.role='member' AND a.test_account=0 AND json_extract(p.data,'$.approvalStatus')='pending') AS pending,(SELECT COUNT(*) FROM portal_accounts WHERE role='member' AND test_account=1) AS testAccounts").first();
    const page=rows.results.slice(0,30),last=page.at(-1);
    return json({members:page.map(member),total:total?.n??0,summary,nextCursor:rows.results.length>30&&last?JSON.stringify({at:last.created_at,id:last.id}):null});
  }catch(error){return errorResponse(error);}
}
