import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import sharp from 'sharp';
import {createNodePortalRuntime} from './node-portal-runtime.mjs';
const origin='https://vedik-milan.softinator.org';process.env.TRUST_CLOUDFLARE_PROXY='1';
const runtime=await createNodePortalRuntime({bindings:{STANDALONE_MODE:'test-portal',REQUIRE_ACCOUNT_MOBILE:'1',PUBLIC_REGISTRATION:'1',PORTAL_KEY:'a'.repeat(64),TURNSTILE_SECRET_KEY:'test'},outboundService:async r=>{const p=new URLSearchParams(await r.text());return Response.json({success:true,hostname:'vedik-milan.softinator.org',action:p.get('response'),challenge_ts:new Date().toISOString()});}});
let checks=0;function eq(a,b){assert.deepEqual(a,b);checks++;}
try{
 const db=await runtime.getD1Database();for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint',''));
 async function actor(role,mobile,mfa=1){const id=randomUUID(),t=randomBytes(32).toString('hex');await db.prepare("INSERT INTO portal_accounts(id,username,role,status,created_at,mobile) VALUES(?,?,?,'active',?,?)").bind(id,'qa.'+id,role,Date.now(),mobile).run();await db.prepare('INSERT INTO portal_sessions(token_hash,account_id,session_version,mfa_verified,created_at,expires_at) VALUES(?,?,0,?,?,?)').bind(createHash('sha256').update(t).digest('hex'),id,mfa,Date.now(),Date.now()+3600000).run();return {id,cookie:'__Host-managelove='+t};}
 const admin=await actor('admin','+919000000000'),weakAdmin=await actor('admin','+919000000001',0),member=await actor('member','+919000000011'),wrong=await actor('member','+919000000012');
 async function call(path,body,cookie='',requestOrigin=origin){const r=await runtime.dispatchFetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json','CF-Connecting-IP':randomUUID(),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};}
 const png=await sharp({create:{width:80,height:100,channels:3,background:'#76506b'}}).png().toBuffer();
 const profile={name:'Fictional Managed Profile',birthDate:'1996-04-15',mobile:'9000000011',gender:'male',community:'Gaur',gotra:'Unknown',city:'Indore',country:'',state:'',district:'',education:'Graduate',profession:'Teacher',height:175,maritalStatus:'Never married',about:'Fictional biodata for isolated management testing.',managedBy:'Self',language:'Hindi',consent:true,termsAccepted:true,turnstile:'post'};
 async function multipart(path,body,photos=[]){const f=new FormData();f.set('details',JSON.stringify(body));photos.forEach(p=>f.append('photo',new Blob([p]),'fictional.png'));const r=await runtime.dispatchFetch(origin+path,{method:'POST',headers:{Origin:origin,'CF-Connecting-IP':randomUUID()},body:f});return {status:r.status,data:await r.json()};}
 async function post(overrides={}){const r=await multipart('/api/submissions',{...profile,...overrides},[png]);eq(r.status,201);return r.data;}
 const created=await post({publicListing:true}),token=created.managementToken;
 const manage=(body={},cookie='',requestOrigin=origin)=>call('/api/submissions/manage',{token,...body},cookie,requestOrigin);
 eq((await manage({token:'f'.repeat(64)})).status,404);eq((await manage({},'', 'https://example.org')).status,403);
 let loaded=await manage();eq(loaded.status,200);eq(loaded.data.profile.birthDate,profile.birthDate);eq(loaded.data.profile.mobile,'+919000000011');eq(loaded.data.photos.length,1);
 eq((await manage({action:'photo',key:randomUUID()})).status,404);
 const photo=await runtime.dispatchFetch(origin+'/api/submissions/manage',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':randomUUID()},body:JSON.stringify({token,action:'photo',key:loaded.data.photos[0].key})});eq(photo.status,200);eq(photo.headers.get('content-type'),'image/jpeg');eq(photo.headers.get('cache-control'),'private, no-store');await photo.arrayBuffer();
 await db.prepare("UPDATE profiles SET data=json_set(data,'$.approvalStatus','approved') WHERE id=?").bind(created.profileId).run();loaded=await manage();
 const originalExpiry=loaded.data.expiresAt,oldKey=loaded.data.photos[0].key;
 const update={token,action:'update',revision:loaded.data.revision,keepPhotos:[],profile:{...loaded.data.profile,about:'Updated fictional biodata for independent review.',consent:true,termsAccepted:true,publicListing:false,approvalStatus:'approved'}};
 eq((await multipart('/api/submissions/manage',{...update,profile:{...update.profile,name:'Changed Identity'}})).status,409);
 eq((await multipart('/api/submissions/manage',{...update,profile:{...update.profile,birthDate:'1990-01-01'}})).status,409);
 eq((await multipart('/api/submissions/manage',{...update,profile:{...update.profile,mobile:'9000000012'}})).status,409);
 eq((await multipart('/api/submissions/manage',{...update,keepPhotos:[randomUUID()]})).status,400);
 eq((await multipart('/api/submissions/manage',update,[png])).status,200);
 eq((await multipart('/api/submissions/manage',update)).status,409);
 loaded=await manage();eq(loaded.data.approvalStatus,'pending');eq(loaded.data.publicListing,true);eq(loaded.data.expiresAt,originalExpiry);eq(loaded.data.profile.about,update.profile.about);eq(loaded.data.photos.length,1);eq(loaded.data.photos[0].key===oldKey,false);
 eq(await db.prepare('SELECT key FROM portal_photos WHERE key=?').bind(oldKey).first(),null);
 eq((await call('/api/state')).data.profiles.some(p=>p.id===created.profileId),false);
 eq((await manage({action:'delete',confirmation:'Wrong name'})).status,400);
 const recovery={mobile:profile.mobile,profileId:created.profileId,turnstile:'recover'};
 eq((await call('/api/submissions/recover',{...recovery,turnstile:'wrong'})).status,403);
 const requested=await call('/api/submissions/recover',recovery);eq(requested.status,202);eq('managementToken' in requested.data,false);
 eq((await call('/api/admin/submissions')).status,401);eq((await call('/api/admin/submissions',undefined,weakAdmin.cookie)).status,403);
 eq((await call('/api/admin/submissions',undefined,admin.cookie)).data.requests.some(r=>r.owner===created.memberId),true);
 eq((await call('/api/admin/submissions',{owner:created.memberId,reason:'Identity independently confirmed'},admin.cookie)).status,400);
 const restored=await call('/api/admin/submissions',{owner:created.memberId,reason:'Original stored contact independently confirmed',identityConfirmed:true},admin.cookie);eq(restored.status,200);
 const newToken=new URL(restored.data.managementUrl).hash.slice(1);eq(newToken===token,false);eq((await manage()).status,404);eq((await manage({token:newToken})).status,200);eq((await call('/api/submissions/privacy',{token})).status,404);
 eq((await call('/api/admin/submissions',undefined,admin.cookie)).data.requests.some(r=>r.owner===created.memberId),false);
 const claim=(cookie)=>manage({token:newToken,action:'claim'},cookie);
 eq((await claim('')).status,401);eq((await claim(wrong.cookie)).status,403);eq((await claim(admin.cookie)).status,401);
 eq((await claim(member.cookie)).status,200);
 eq((await db.prepare('SELECT owner FROM profiles WHERE id=?').bind(created.profileId).first()).owner,member.id);
 eq((await db.prepare('SELECT profile_id FROM identity_locks WHERE owner=?').bind(member.id).first()).profile_id,created.profileId);
 eq((await db.prepare('SELECT references_json FROM profile_private WHERE owner=?').bind(member.id).first()).references_json,'[]');
 const own=await call('/api/state',undefined,member.cookie);eq(own.data.own.id,created.profileId);eq(own.data.ownPrivate.birthDate,profile.birthDate);
 eq((await call('/api/profile',{...loaded.data.profile,about:'Fictional profile updated through its linked member account.',consent:true,termsAccepted:true},member.cookie)).status,200);
 eq((await manage({token:newToken})).status,404);eq((await call('/api/submissions/privacy',{token:newToken})).status,404);
 eq((await call('/api/admin/submissions',{owner:created.memberId,reason:'Attempt recovery after ownership transfer',identityConfirmed:true},admin.cookie)).status,404);
 const duplicate=await post();eq((await call('/api/submissions/manage',{token:duplicate.managementToken,action:'claim'},member.cookie)).status,409);
 const removable=await post({name:'Fictional Delete Profile'});const deletion=await call('/api/submissions/manage',{token:removable.managementToken,action:'delete',confirmation:'Fictional Delete Profile'});eq(deletion.status,200);eq(deletion.data.deleted,true);
 eq(await db.prepare('SELECT id FROM profiles WHERE id=?').bind(removable.profileId).first(),null);eq((await call('/api/submissions/manage',{token:removable.managementToken})).status,404);
 eq((await db.prepare('SELECT COUNT(*) AS n FROM profile_photos WHERE profile_id=?').bind(removable.profileId).first()).n,0);
 eq((await db.prepare('SELECT COUNT(*) AS n FROM portal_photos WHERE key NOT IN (SELECT key FROM profile_photos)').first()).n,0);
 const expired=await post({name:'Fictional Expired Profile'});await db.prepare('UPDATE profiles SET expires_at=? WHERE id=?').bind(Date.now()-1,expired.profileId).run();eq((await call('/api/submissions/manage',{token:expired.managementToken})).status,404);
 console.log(`PASS: ${checks} guest editing, protected photos, moderation, deletion, recovery and account linking checks`);
}finally{await runtime.dispose();}
