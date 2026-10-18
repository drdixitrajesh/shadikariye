import {db,identity,json,errorResponse,fromRow} from '@/lib/store';
import {adminIdentity} from '@/lib/admin';
import {DEMO_PROFILES} from '@/lib/matrimony';
import {otpReady,verified,indianDay,reserveView,blocked,ageFromDate,testAccess,memberAccess} from '@/lib/security';
import {isPortal} from '@/lib/portal-auth';
import {publicProfiles} from '@/lib/public-profiles';
export const dynamic='force-dynamic';
export async function GET(){
  const owner=await identity();
  try{
    if(!owner){const profiles=await publicProfiles();return json({profiles:profiles.length?profiles:DEMO_PROFILES,own:null,saved:[],sent:[],received:[],isAdmin:false,security:{otpReady:otpReady(),verified:false},quota:{limit:20,used:0,day:indianDay()}});}
    const isVerified=await verified(owner);
    const isAdministrator=Boolean(await adminIdentity());
    const [own,saved,sent,received,lock,privateData]=await Promise.all([
      db().prepare('SELECT id,data,photo_key,published_at,expires_at FROM profiles WHERE owner=?').bind(owner).first<{id:string;data:string;photo_key:string|null;published_at:number;expires_at:number}>(),
      db().prepare('SELECT target FROM saved_profiles WHERE owner=?').bind(owner).all<{target:string}>(),
      db().prepare('SELECT id,sender_profile,target,message,status,created_at FROM interests WHERE sender=? ORDER BY created_at DESC').bind(owner).all(),
      db().prepare('SELECT i.id,i.sender_profile,i.target,i.message,i.status,i.created_at FROM interests i JOIN profiles p ON i.target=p.id WHERE p.owner=? ORDER BY i.created_at DESC').bind(owner).all(),
      db().prepare('SELECT name,birth_date,aadhaar_last4 FROM identity_locks WHERE owner=?').bind(owner).first(),
      db().prepare('SELECT references_json FROM profile_private WHERE owner=?').bind(owner).first<{references_json:string}>(),
    ]);
    const rows=(isVerified||memberAccess(owner)||isAdministrator)?await db().prepare('SELECT p.id,p.data,p.photo_key,l.birth_date FROM profiles p LEFT JOIN identity_locks l ON l.owner=p.owner WHERE p.owner<>? AND (p.id IN (SELECT target FROM daily_views WHERE owner=? AND day=?) OR p.id IN (SELECT target FROM saved_profiles WHERE owner=?) OR p.id IN (SELECT target FROM interests WHERE sender=?) OR p.id IN (SELECT i.sender_profile FROM interests i JOIN profiles p2 ON p2.id=i.target WHERE p2.owner=?) OR p.id IN (SELECT id FROM profiles ORDER BY updated_at DESC LIMIT 500)) ORDER BY CASE WHEN p.id IN (SELECT target FROM daily_views WHERE owner=? AND day=?) THEN 0 WHEN p.id IN (SELECT target FROM saved_profiles WHERE owner=?) THEN 1 ELSE 2 END,p.updated_at DESC').bind(owner,owner,indianDay(),owner,owner,owner,owner,indianDay(),owner).all<{id:string;data:string;photo_key:string|null;birth_date:string|null}>():{results:[]};
    const visible=[];
    for(const row of rows.results){if(visible.length>=20)break;if(await blocked(owner,row.id))continue;if(await reserveView(owner,row.id)){const p=fromRow(row);if(row.birth_date)p.age=ageFromDate(row.birth_date);visible.push(p);}else break;}
    for(const demo of (isPortal()?[]:DEMO_PROFILES)){if(visible.length>=20)break;if(await reserveView(owner,demo.id))visible.push(demo);}
    const ownProfile=own?fromRow(own):null;
    if(ownProfile){if(lock)ownProfile.age=ageFromDate(String(lock.birth_date));visible.push(ownProfile);}
    const photoIds=visible.filter(p=>!p.demo).map(p=>p.id);
    const photos=photoIds.length?await db().prepare('SELECT profile_id,key,slot FROM profile_photos WHERE profile_id IN ('+photoIds.map(()=>'?').join(',')+') ORDER BY slot').bind(...photoIds).all<{profile_id:string;key:string;slot:number}>():{results:[]};
    for(const p of visible){if(p.demo)continue;p.photoSlots=photos.results.filter(x=>x.profile_id===p.id).map(x=>({slot:x.slot,key:x.key}));p.photoKeys=p.photoSlots.map(x=>x.key);if(p.photoKey&&!p.photoKeys.includes(p.photoKey))p.photoKeys.unshift(p.photoKey);p.phoneVerified=Boolean(await db().prepare('SELECT 1 FROM profiles p JOIN otp_accounts o ON o.owner=p.owner WHERE p.id=? AND o.verified_at>0').bind(p.id).first());}
    const count=await db().prepare('SELECT COUNT(*) AS n FROM daily_views WHERE owner=? AND day=?').bind(owner,indianDay()).first<{n:number}>();
    return json({profiles:visible,own:ownProfile,saved:saved.results.map(s=>s.target),sent:sent.results,received:received.results,ownPrivate:{name:lock?.name??ownProfile?.name??'',birthDate:lock?.birth_date??'',aadhaarLast4:lock?.aadhaar_last4??'',locked:Boolean(lock),references:privateData?JSON.parse(privateData.references_json):[]},isAdmin:isAdministrator,security:{otpReady:otpReady(),verified:isVerified,testAccess:testAccess(owner),canPublish:memberAccess(owner),standalone:isPortal()},quota:{limit:20,used:count?.n??0,day:indianDay()}});
  }catch(e){return errorResponse(e);}
}
