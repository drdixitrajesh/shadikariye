import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createNodePortalRuntime} from './node-portal-runtime.mjs';
process.env.TRUST_CLOUDFLARE_PROXY='1';
const origin='https://vedik-milan.softinator.org';
const runtime=await createNodePortalRuntime({bindings:{STANDALONE_MODE:'test-portal',REQUIRE_ACCOUNT_MOBILE:'1',PUBLIC_REGISTRATION:'1',PORTAL_KEY:'a'.repeat(64),TURNSTILE_SECRET_KEY:'test'},outboundService:async request=>{const params=new URLSearchParams(await request.text());return Response.json({success:true,hostname:'vedik-milan.softinator.org',action:params.get('response'),challenge_ts:new Date().toISOString()});}});
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{
 const db=await runtime.getD1Database();
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
 async function call(path,body,cookie='',requestOrigin=origin){const r=await runtime.dispatchFetch(origin+path,{method:body?'POST':'GET',headers:{Origin:requestOrigin,'Content-Type':'application/json','CF-Connecting-IP':randomUUID(),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 for(const path of ['/iphone-app','/.well-known/assetlinks.json','/downloads/vedik-milan-1.0.0.apk','/manifest.webmanifest','/sw.js','/offline.html','/icons/app-180.png','/icons/app-192.png','/icons/app-512.png','/icons/app-maskable.png','/fonts/NotoSansDevanagari.ttf']){const response=await runtime.dispatchFetch(origin+path);eq(response.status===303,false);eq(response.headers.get('location'),null);}
 const signup={username:'privacy.mobile.qa',mobile:'9000000011',password:'Fictional secure password 2026!',termsAccepted:true,turnstile:'register'};
 const registered=await call('/api/portal/register',signup);eq(registered.status,201);
 eq((await call('/api/portal/login',{username:signup.username,password:signup.password,turnstile:'login'})).status,400);
 eq((await call('/api/portal/login',{identifier:signup.username,password:signup.password,turnstile:'login'})).status,400);
 eq((await call('/api/portal/login',{password:signup.password,turnstile:'login'})).status,400);
 eq((await call('/api/portal/login',{identifier:'12345',password:signup.password,turnstile:'login'})).status,400);
 eq((await call('/api/portal/login',{identifier:'+91 90000 00011',password:signup.password,turnstile:'login'})).status,200);
 eq((await call('/api/portal/login',{identifier:signup.mobile,password:'Wrong secure password 2026!',turnstile:'login'})).status,401);
 const login=await call('/api/portal/login',{mobile:signup.mobile,password:signup.password,turnstile:'login'});eq(login.status,200);eq(Boolean(login.cookie),true);
 const adminId=randomUUID(),token=randomBytes(32).toString('hex');
 await db.prepare("INSERT INTO portal_accounts(id,username,role,status,created_at,mobile) VALUES(?,?,'admin','active',?,?)").bind(adminId,'qa.admin',Date.now(),'+919000000000').run();
 await db.prepare('INSERT INTO portal_sessions(token_hash,account_id,session_version,mfa_verified,created_at,expires_at) VALUES(?,?,0,1,?,?)').bind(createHash('sha256').update(token).digest('hex'),adminId,Date.now(),Date.now()+3600000).run();
 const adminCookie='__Host-managelove='+token;
 const profile={name:'Fictional Privacy QA',birthDate:'1996-04-15',mobile:'9000000022',gender:'male',community:'Gaur',gotra:'Unknown',city:'Indore',country:'',state:'',district:'',education:'Graduate',profession:'Teacher',height:175,maritalStatus:'Never married',about:'Fictional profile for privacy control testing.',managedBy:'Self',language:'Hindi',consent:true,termsAccepted:true,turnstile:'post'};
 async function post(details,cookie=''){const f=new FormData();f.set('details',JSON.stringify(details));const r=await runtime.dispatchFetch(origin+'/api/submissions',{method:'POST',headers:{Origin:origin,'CF-Connecting-IP':randomUUID(),...(cookie?{Cookie:cookie}:{})},body:f});return {status:r.status,data:await r.json()};}
 const guest=await post(profile);eq(guest.status,201);eq(guest.data.approvalStatus,'pending');eq(/^[a-f0-9]{64}$/.test(guest.data.managementToken),true);
 const access=await db.prepare('SELECT token_hash FROM submission_access WHERE owner=?').bind(guest.data.memberId).first();eq(access.token_hash,createHash('sha256').update(guest.data.managementToken).digest('hex'));eq(access.token_hash===guest.data.managementToken,false);
 const privacy=body=>call('/api/submissions/privacy',{token:guest.data.managementToken,...body});
 eq((await privacy({})).data.publicListing,false);
 eq((await privacy({publicListing:true})).data.publicListing,true);
 eq((await call('/api/state')).data.profiles.some(p=>p.id===guest.data.profileId),false);
 const pending=await db.prepare('SELECT data FROM profiles WHERE id=?').bind(guest.data.profileId).first();
 eq((await call('/api/admin/profiles/review',{id:guest.data.profileId,decision:'approved',reviewToken:JSON.parse(pending.data).reviewToken},adminCookie)).status,200);
 eq((await call('/api/state')).data.profiles.some(p=>p.id===guest.data.profileId),true);
 const projected=(await call('/api/state')).data.profiles.find(p=>p.id===guest.data.profileId);eq('mobile' in projected,false);eq('references' in projected,false);eq('managementToken' in projected,false);
 eq((await privacy({publicListing:false})).data.publicListing,false);
 eq((await call('/api/state')).data.profiles.some(p=>p.id===guest.data.profileId),false);
 eq((await call('/api/state',undefined,login.cookie)).data.profiles.some(p=>p.id===guest.data.profileId),true);
 eq((await privacy({publicListing:'yes'})).status,400);
 eq((await call('/api/submissions/privacy',{token:'f'.repeat(64),publicListing:true})).status,404);
 eq((await call('/api/submissions/privacy',{token:guest.data.managementToken,publicListing:true},'','https://example.org')).status,403);
 const direct=await post({...profile,publicListing:true},adminCookie);eq(direct.status,201);eq((await call('/api/state')).data.profiles.some(p=>p.id===direct.data.profileId),true);
 await privacy({publicListing:true,id:direct.data.profileId,owner:direct.data.memberId});
 eq((await call('/api/submissions/privacy',{token:direct.data.managementToken})).data.publicListing,true);
 await db.prepare('UPDATE submission_access SET expires_at=? WHERE owner=?').bind(Date.now()-1,guest.data.memberId).run();eq((await privacy({publicListing:false})).status,404);
 const deleted=await runtime.dispatchFetch(origin+'/api/admin/profiles',{method:'DELETE',headers:{Origin:origin,Cookie:adminCookie,'Content-Type':'application/json'},body:JSON.stringify({id:direct.data.profileId,confirmation:profile.name,reason:'Remove fictional privacy QA profile'})});eq(deleted.status,200);
 eq((await call('/api/submissions/privacy',{token:direct.data.managementToken})).status,404);
 eq((await db.prepare('SELECT COUNT(*) AS n FROM submission_access WHERE owner=?').bind(direct.data.memberId).first()).n,0);
 console.log(`PASS: ${checks} production mobile-login and owner privacy checks`);
}finally{await runtime.dispose();}
