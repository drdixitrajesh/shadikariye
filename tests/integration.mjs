import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {Miniflare}=await import(require.resolve('miniflare',{paths:[realpathSync('node_modules/wrangler')]}));
function workerModules(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?workerModules(resolve(dir,f.name)):f.name.endsWith('.js')||f.name.endsWith('.mjs')?[{type:'ESModule',path:resolve(dir,f.name)}]:[]);}
const modules=workerModules(resolve('dist/server'));modules.sort((a,b)=>a.path===resolve('dist/server/index.js')?-1:b.path===resolve('dist/server/index.js')?1:0);
const config={
  modules,modulesRoot:resolve('dist/server'),
  modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs']}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  d1Databases:{DB:'test-db',MIGRATION:'migration-test-db'},r2Buckets:{BUCKET:'test-photos'},
  bindings:{ADMIN_EMAILS:'moderator@test.invalid',TWILIO_ACCOUNT_SID:'test-account',TWILIO_AUTH_TOKEN:'test-token',TWILIO_VERIFY_SERVICE_SID:'test-service',OTP_HASH_SECRET:'test-secret-with-at-least-32-characters'},
  outboundService:async request=>{if(request.url.startsWith('https://verify.twilio.com/')){const form=new URLSearchParams(await request.text());return Response.json({status:request.url.endsWith('VerificationCheck')?(form.get('Code')==='123456'?'approved':'pending'):'pending'});}return new Response('Outbound request disallowed',{status:403});},
};
const mf=new Miniflare(config);
let checks=0;
async function call(path,owner=null,method='GET',data,extraHeaders={}){
  const headers=new Headers(extraHeaders);
  if(owner){headers.set('oai-authenticated-user-id',owner);headers.set('oai-authenticated-user-email',owner+'@test.invalid');}
  let body;
  if(data instanceof FormData){const encoded=new Request('https://test.local'+path,{method:'POST',body:data});body=await encoded.arrayBuffer();headers.set('content-type',encoded.headers.get('content-type'));}
  else if(data!==undefined){body=JSON.stringify(data);headers.set('content-type','application/json');}
  const response=await mf.dispatchFetch('https://test.local'+path,{method,headers,body});
  const type=response.headers.get('content-type')??'';
  return {status:response.status,data:type.includes('json')?await response.json():await response.text()};
}
function check(value,message){assert.ok(value,message);checks++;if(checks%10===0)console.log(checks+' integration checks passed');}
const fixture=(name,gotra)=>({name,birthDate:'1998-01-01',aadhaarLast4:'1234',termsAccepted:true,references:[{name:'Reference One',relationship:'Uncle',phone:'+919876543210',consent:true},{name:'Reference Two',relationship:'Friend',phone:'+919876543211',consent:true}],age:28,gender:'female',community:'Kanyakubj',gotra,city:'Lucknow',education:'MBA',profession:'Designer',height:165,maritalStatus:'Never married',about:'I value family, kindness and open conversations.',managedBy:'Self',language:'Hindi',consent:true});
try{
  const db=await mf.getD1Database('DB');
  for(const statement of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort().map(f=>readFileSync('drizzle/'+f,'utf8')).join(';').replaceAll('--> statement-breakpoint','').split(';').filter(s=>s.trim()))await db.prepare(statement).run();
  const migrationDb=await mf.getD1Database('MIGRATION');
  for(const statement of readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&!f.startsWith('0004_')).sort().map(f=>readFileSync('drizzle/'+f,'utf8')).join(';').replaceAll('--> statement-breakpoint','').split(';').filter(s=>s.trim()))await migrationDb.prepare(statement).run();
  const legacyTime=Date.parse('2026-08-31T00:05:00+05:30');
  await migrationDb.prepare("INSERT INTO profiles(id,owner,data,updated_at) VALUES('legacy','legacy','{}',?)").bind(legacyTime).run();
  await migrationDb.prepare("INSERT INTO identity_locks(owner,profile_id,name,birth_date,aadhaar_last4,created_at) VALUES('legacy','legacy','Legacy Name','1998-01-01','1234',1)").run();
  for(const statement of readFileSync('drizzle/0004_many_korg.sql','utf8').replaceAll('--> statement-breakpoint','').split(';').filter(s=>s.trim()))await migrationDb.prepare(statement).run();
  const legacy=await migrationDb.prepare("SELECT published_at,expires_at FROM profiles WHERE id='legacy'").first();
  check(legacy.published_at===legacyTime&&legacy.expires_at===Date.parse('2027-02-28T00:05:00+05:30'),'Legacy migration uses current post time, not a retained identity lock, and clamps India month end');
  let r=await call('/api/profile','unverified','POST',fixture('Unverified User','Kashyap'));check(r.status===403,'OTP is mandatory before publication');
  for(const [owner,phone] of [['alice','+919876543220'],['bob','+919876543221'],['charlie','+919876543222']]){
    r=await call('/api/otp',owner,'POST',{action:'send',phone});check(r.status===200,'OTP sent through mocked provider');
    r=await call('/api/otp',owner,'POST',{action:'verify',phone,code:'000000'});check(r.status===400,'Incorrect OTP rejected');
    r=await call('/api/otp',owner,'POST',{action:'verify',phone,code:'123456'});check(r.status===200,'Correct provider-verified OTP accepted');
  }
  r=await call('/api/state');check(r.status===200&&r.data.profiles.length===6&&r.data.profiles.every(p=>p.demo),'Anonymous visitors see only labelled fictional demos');
  r=await call('/api/profile',null,'POST',fixture('Test Alice','Shandilya'));check(r.status===401,'Unauthenticated profile writes are rejected');
  r=await call('/api/profile','alice','POST',fixture('Test Alice','Shandilya'),{origin:'https://other.invalid'});check(r.status===403,'Cross-origin writes are rejected');
  r=await call('/api/profile','alice','POST',{...fixture('Test Alice','Shandilya'),birthDate:'2015-01-01'});check(r.status===400,'Underage profiles are rejected');
  r=await call('/api/profile','alice','POST',{...fixture('Test Alice','Shandilya'),consent:false});check(r.status===400,'Publication requires explicit consent');
  r=await call('/api/profile','alice','POST',fixture('Test Alice','shandiyla'));check(r.status===200&&r.data.profile.gotra==='Shandilya','A consenting profile is saved with a canonical gotra');const alice=r.data.profile.id;check(Number.isFinite(r.data.profile.expiresAt)&&r.data.profile.expiresAt>Date.now(),'New publication has a six-month expiry');const aliceExpiry=r.data.profile.expiresAt;
  r=await call('/api/profile','bob','POST',{...fixture('Test Bob','Bharadwaj'),gender:'male'});check(r.status===200,'Second member registration succeeds');const bob=r.data.profile.id;
  r=await call('/api/profile','bob','POST',{...fixture('Test Bob Updated','Bharadwaj'),gender:'male'});check(r.status===409,'Name cannot be changed through the API');
  r=await call('/api/profile','bob','POST',{...fixture('Test Bob','Bharadwaj'),gender:'male',city:'Pune'});check(r.status===200&&r.data.profile.id===bob,'Mutable edits preserve profile identity');
  await call('/api/state','alice');
  r=await call('/api/profile','alice','POST',{...fixture('Test Alice','Shandilya'),email:'not-an-email'});check(r.status===400,'Invalid optional email rejected');
  r=await call('/api/profile','alice','POST',{...fixture('Test Alice','Shandilya'),email:'  alice.contact@example.com  '});check(r.status===200&&r.data.profile.email==='alice.contact@example.com','Optional email persists and is trimmed');check(r.data.profile.expiresAt===aliceExpiry,'Editing does not extend expiry');
  r=await call('/api/state','bob');check(r.data.profiles.find(p=>p.id===alice)?.email==='alice.contact@example.com','Consented contact email is visible in an allowed profile');
  r=await call('/api/state');check(!r.data.profiles.some(p=>p.email==='alice.contact@example.com'),'Anonymous visitors cannot read real contact emails');
  r=await call('/api/profile','alice','POST',{...fixture('Test Alice','Shandilya'),email:'new.contact@example.com'});check(r.status===200&&r.data.profile.email==='new.contact@example.com','Email remains editable after identity lock');
  r=await call('/api/profile','alice','POST',{...fixture('Test Alice','Shandilya'),email:'   '});check(r.status===200&&r.data.profile.email==='','Optional email can be cleared');
  r=await call('/api/state','bob');check(r.data.profiles.find(p=>p.id===alice)?.email==='','Cleared email removed from subsequent profile reads');
  check(r.data.own.email==='','Omitting optional email never publishes sign-in email');
  r=await call('/api/actions','alice','POST',{kind:'save',target:bob,saved:true});check(r.status===200,'A real profile can be shortlisted');
  r=await call('/api/state','alice');check(r.data.saved.includes(bob)&&r.data.own.id===alice,'Profile and shortlist survive a fresh read');
  for(const body of [{...fixture('Test Alice','Shandilya'),birthDate:'1997-01-01'},{...fixture('Test Alice','Shandilya'),aadhaarLast4:'5678'}]){r=await call('/api/profile','alice','POST',body);check(r.status===409,'Private locked identity cannot be altered');}
  r=await call('/api/profile','alice','POST',{...fixture('Test Alice','Shandilya'),aadhaarNumber:'123412341234'});check(r.status===400,'Full Aadhaar rejected');
  r=await call('/api/profile','alice','POST',{...fixture('Test Alice','Shandilya'),references:[]});check(r.status===400,'Two references are required');
  r=await call('/api/otp','duplicate-user','POST',{action:'send',phone:'+919876543220'});check(r.status===409,'Verified phone cannot be attached to a second account');
  r=await call('/api/otp','pending-one','POST',{action:'send',phone:'+919876543225'});check(r.status===200,'Pending phone reservation created');
  r=await call('/api/otp','pending-one','POST',{action:'send',phone:'+919876543225'});check(r.status===429,'OTP resend throttled');
  await db.prepare('UPDATE otp_accounts SET expires_at=0 WHERE owner=?').bind('pending-one').run();
  r=await call('/api/otp','pending-two','POST',{action:'send',phone:'+919876543225'});check(r.status===200,'Expired unverified phone reservation can be reclaimed');
  for(let i=0;i<5;i++){r=await call('/api/otp','pending-two','POST',{action:'verify',phone:'+919876543225',code:'000000'});check(r.status===400,'Incorrect OTP is denied');}
  r=await call('/api/otp','pending-two','POST',{action:'verify',phone:'+919876543225',code:'123456'});check(r.status===429,'OTP attempt cap enforced even for a later correct code');
  r=await call('/api/actions','alice','POST',{kind:'interest',target:'demo-ananya'});check(r.status===422,'Fictional demos cannot receive interests');
  r=await call('/api/actions','alice','POST',{kind:'interest',target:bob,message:'Hello from Alice'});check(r.status===200,'Interest is delivered to a real member');
  r=await call('/api/state','bob');check(r.data.received.length===1&&r.data.received[0].sender_profile===alice,'Recipient receives the correct interest');const thread=r.data.received[0].id;
  r=await call('/api/messages','alice','POST',{thread,body:'premature'});check(r.status===403,'Messages require accepted interest');
  r=await call('/api/actions','alice','PATCH',{id:thread,status:'accepted'});check(r.status===404,'Sender cannot accept on behalf of recipient');
  r=await call('/api/actions','bob','PATCH',{id:thread,status:'accepted'});check(r.status===200,'Recipient can accept the interest');
  r=await call('/api/messages','alice','POST',{thread,body:'Hello Bob'});check(r.status===200,'Accepted sender can send a message');
  r=await call('/api/messages','bob','POST',{thread,body:'Hello Alice'});check(r.status===200,'Accepted recipient can reply');
  r=await call('/api/messages?thread='+thread,'charlie');check(r.status===403,'Unrelated member cannot read private messages');
  r=await call('/api/messages?thread='+thread,'bob');check(r.status===200&&r.data.messages.length===2&&r.data.messages.find(m=>m.body==='Hello Alice').mine,'Private conversation roundtrip preserves sender attribution');
  const seed=[];const now=Date.now()-2000;
  for(let i=0;i<501;i++)seed.push(db.prepare('INSERT INTO messages (id,interest_id,sender,body,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),thread,'alice','Historic '+i,now+i));
  for(let i=0;i<seed.length;i+=100)await db.batch(seed.slice(i,i+100));
  r=await call('/api/messages','alice','POST',{thread,body:'Newest message after 500'});check(r.status===200,'Long conversations can still receive new messages');
  r=await call('/api/messages?thread='+thread,'bob');check(r.data.messages.length===500&&r.data.hasMore&&r.data.messages.some(m=>m.body==='Newest message after 500'),'Newest messages remain visible beyond 500');
  const oldest=r.data.messages[0];
  r=await call('/api/messages?thread='+thread+'&before='+oldest.created_at+'&beforeId='+oldest.id,'bob');check(r.status===200&&r.data.messages.length===4&&r.data.messages.some(m=>m.body==='Historic 0'),'Older messages are reachable by cursor without duplicates');
  const profiles=[];
  for(let i=0;i<501;i++)profiles.push(db.prepare('INSERT INTO profiles (id,owner,data,updated_at,published_at,expires_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),'fixture-'+i,JSON.stringify(fixture('Synthetic '+i,'Kashyap')),Date.now()+i+10000,Date.now(),Date.now()+180*86400000));
  for(let i=0;i<profiles.length;i+=100)await db.batch(profiles.slice(i,i+100));
  r=await call('/api/state','alice');check(r.data.profiles.some(p=>p.id===bob)&&r.data.sent.length===1&&r.data.saved.includes(bob)&&r.data.quota.used===20&&r.data.profiles.filter(p=>p.id!==alice).length===20,'Older shortlisted and conversation counterpart remains available outside recent catalog');
  r=await call('/api/state','alice');const seen=r.data.profiles.map(p=>p.id);
  await db.prepare('INSERT INTO profiles (id,owner,data,updated_at,published_at,expires_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),'late-fixture',JSON.stringify(fixture('New Later','Atri')),Date.now()+99999999,Date.now(),Date.now()+180*86400000).run();
  const concurrent=await Promise.all(Array.from({length:4},()=>call('/api/state','alice')));check(concurrent.every(r=>r.data.quota.used===20&&r.data.profiles.every(p=>p.id===alice||seen.includes(p.id))),'Concurrent refresh cannot reveal a 21st profile');
  r=await call('/api/state','bob');check(r.data.profiles.every(p=>!('birthDate' in p)&&!('references' in p)&&!('aadhaarLast4' in p)),'Other users never receive private identity or references');
  const photo=new FormData();photo.append('photo',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB7sAAAAASUVORK5CYII=','base64')],'test.png',{type:'image/png'}));
  r=await call('/api/photo','alice','POST',photo);check(r.status===200&&r.data.photoKey,'Consented photo upload persists');const key=r.data.photoKey;
  r=await call('/api/photo/'+key);check(r.status===401,'Photos require authenticated access');
  r=await call('/api/photo/'+key,'bob');check(r.status===200,'Authenticated member can read a published profile photo');
  for(let slot=1;slot<5;slot++){photo.set('slot',String(slot));r=await call('/api/photo','alice','POST',photo);check(r.status===200,'Additional photo slot '+slot+' persists');}
  photo.set('slot','5');r=await call('/api/photo','alice','POST',photo);check(r.status===400,'Sixth photo rejected server-side');
  r=await call('/api/state','alice');check(r.data.own.photoKeys.length===5,'Owner sees all five uploaded photos');
  r=await call('/api/photo/'+key,'charlie');check(r.status===403,'Photo URLs cannot bypass the daily allowance');
  r=await call('/api/actions','charlie','PATCH',{id:thread,status:'ended'});check(r.status===404,'Unrelated member cannot end a conversation');
  r=await call('/api/actions','alice','PATCH',{id:thread,status:'ended'});check(r.status===200,'Either participant can end an accepted conversation');
  r=await call('/api/messages','bob','POST',{thread,body:'No more'});check(r.status===403,'Ending a conversation blocks future messages');
  await db.prepare("UPDATE interests SET status='accepted' WHERE id=?").bind(thread).run();
  r=await call('/api/safety','bob','POST',{kind:'block',target:alice});check(r.status===200,'Block works without an optional report reason');
  r=await call('/api/messages','alice','POST',{thread,body:'Blocked message'});check(r.status===403,'Blocked contact cannot send messages');
  r=await call('/api/state','bob');check(!r.data.profiles.some(p=>p.id===alice),'Blocked profile hidden from feed');
  r=await call('/api/profile','alice','DELETE');check(r.status===200,'Profile deletion succeeds');
  r=await call('/api/state','bob');check(!r.data.profiles.some(p=>p.id===alice)&&r.data.received.length===0,'Deletion removes published profile and related interests');
  const remaining=await db.prepare('SELECT count(*) AS n FROM messages WHERE interest_id=?').bind(thread).first();check(remaining.n===0,'Deletion removes related private messages');
  check(await(await mf.getR2Bucket('BUCKET')).get(key)===null,'Deletion removes the published photo');
  r=await call('/api/profile','alice','POST',fixture('Changed After Deletion','Atri'));check(r.status===409,'Deletion cannot evade the locked name');
  r=await call('/api/profile','alice','POST',fixture('Test Alice','Atri'));check(r.status===200&&r.data.profile.id===alice,'Recreation preserves stable profile ID');
  r=await call('/api/actions','alice','POST',{kind:'interest',target:bob});check(r.status===403,'Recreation cannot evade a block');
  r=await call('/api/safety','bob','POST',{kind:'report',target:bob,reason:'Suspicious profile information'});check(r.status===400,'Member cannot report themselves');
  r=await call('/api/safety','bob','POST',{kind:'report',target:alice,reason:'Suspicious profile information'});check(r.status===200&&r.data.reviewStatus==='pending','Report is persisted as pending, not falsely reviewed');
  const report=await db.prepare('SELECT reason FROM reports WHERE owner=? AND target=?').bind('bob',alice).first();check(report?.reason==='Suspicious profile information','Report reason stored for authorized review');
  await db.prepare('UPDATE daily_views SET day=? WHERE owner=?').bind('2000-01-01','alice').run();
  r=await call('/api/state','alice');check(r.data.quota.used===20&&r.data.profiles.some(p=>p.name==='New Later'),'A new India calendar day permits a fresh twenty-profile feed');
  r=await call('/api/admin/profiles');check(r.status===401,'Anonymous visitors cannot access admin profiles');
  r=await call('/api/admin/profiles','alice');check(r.status===403,'Ordinary members cannot access admin listings');
  r=await call('/api/profile','alice','POST',{...fixture('Test Alice','Atri'),email:'moderator@test.invalid'});check(r.status===200,'Member can supply a contact email without changing role');
  r=await call('/api/admin/profiles','alice');check(r.status===403,'An optional contact email cannot grant admin privileges');
  r=await call('/api/admin/profiles','moderator');check(r.status===200&&r.data.total>500&&r.data.profiles.length===30&&r.data.nextCursor,'Admin can page through profiles beyond the daily allowance');
  check(r.data.profiles.every(p=>!('birthDate' in p)&&!('references' in p)&&!('aadhaarLast4' in p)),'Admin list excludes unneeded private identity and reference data');
  const firstPage=r.data.profiles.map(p=>p.id),nextCursor=r.data.nextCursor;
  r=await call('/api/admin/profiles?before='+encodeURIComponent(nextCursor),'moderator');check(r.status===200&&r.data.profiles.every(p=>!firstPage.includes(p.id)),'Admin pagination has no duplicate profiles');
  r=await call('/api/admin/profiles?q='+encodeURIComponent('Test Alice'),'moderator');check(r.status===200&&r.data.total===1&&r.data.profiles[0].id===alice,'Admin search finds any profile by name');
  r=await call('/api/state','moderator');check(r.data.isAdmin===true,'Admin entry is advertised to authorized accounts');
  r=await call('/api/state','alice');check(r.data.isAdmin===false,'Admin entry not advertised to ordinary members');
  photo.set('slot','0');r=await call('/api/photo','alice','POST',photo);check(r.status===200,'Moderation target has a stored photo');const adminPhoto=r.data.photoKey;
  const removal={id:alice,confirmation:'Test Alice',reason:'Removed after moderator review'};
  r=await call('/api/admin/profiles','bob','DELETE',removal);check(r.status===403,'Non-admin deletion of another profile denied');
  r=await call('/api/admin/profiles','moderator','DELETE',removal,{origin:'https://other.invalid'});check(r.status===403,'Cross-origin admin deletion denied');
  r=await call('/api/admin/profiles','moderator','DELETE',{...removal,confirmation:'Wrong Name'});check(r.status===400,'Admin deletion requires matching profile name');
  r=await call('/api/admin/profiles','moderator','DELETE',removal);check(r.status===200&&r.data.deleted&&!r.data.cleanupPending,'Admin deletes any selected member profile');
  check(await db.prepare('SELECT id FROM profiles WHERE id=?').bind(alice).first()===null&&await db.prepare('SELECT owner FROM profile_private WHERE owner=?').bind('alice').first()===null,'Admin deletion removes profile and private references');
  check(await(await mf.getR2Bucket('BUCKET')).get(adminPhoto)===null,'Admin deletion removes stored photos');
  check(Boolean(await db.prepare('SELECT id FROM profiles WHERE id=?').bind(bob).first()),'Admin removal leaves other members intact');
  check(Boolean(await db.prepare('SELECT owner FROM identity_locks WHERE owner=?').bind('alice').first()),'Moderation retains permanent identity and anti-abuse state');
  const audit=await db.prepare('SELECT actor,reason FROM admin_actions WHERE target=?').bind(alice).first();check(audit?.actor==='moderator'&&audit.reason===removal.reason,'Admin deletion is audited with trusted actor identity');
  r=await call('/api/admin/profiles','moderator','DELETE',removal);check(r.status===404,'Repeated deletion does not generate misleading success');
  r=await call('/api/profile','alice','POST',{...fixture('Test Alice','Shandilya'),expiresAt:1});check(r.status===200&&r.data.profile.expiresAt>Date.now(),'Republishing creates a fresh server-controlled expiry');const expiredPublication=r.data.profile.publishedAt;
  photo.set('slot','0');r=await call('/api/photo','alice','POST',photo);const expiredPhoto=r.data.photoKey;
  await db.prepare("INSERT INTO interests(id,sender,sender_profile,target,message,status,created_at) VALUES('expiry-thread','alice',?,?,'hello','accepted',?)").bind(alice,bob,Date.now()).run();
  await db.prepare("INSERT INTO messages(id,interest_id,sender,body,created_at) VALUES('expiry-message','expiry-thread','alice','private',?)").bind(Date.now()).run();
  await db.prepare('UPDATE profiles SET expires_at=? WHERE id=?').bind(Date.now()-1,alice).run();
  r=await call('/api/photo/'+expiredPhoto,'bob');check(r.status===404,'Expired photos cannot be accessed even by a previously allowed viewer');
  check(await db.prepare('SELECT id FROM profiles WHERE id=?').bind(alice).first()===null,'Expiry removes the stored profile');
  check(await db.prepare('SELECT owner FROM profile_private WHERE owner=?').bind('alice').first()===null,'Expiry removes private references');
  check(await db.prepare("SELECT id FROM messages WHERE id='expiry-message'").first()===null&&await db.prepare("SELECT id FROM interests WHERE id='expiry-thread'").first()===null,'Expiry cascades through messages and interests');
  check(await(await mf.getR2Bucket('BUCKET')).get(expiredPhoto)===null,'Expiry deletes stored photos');
  check(Boolean(await db.prepare('SELECT owner FROM identity_locks WHERE owner=?').bind('alice').first()),'Expiry preserves locked identity');
  check(Boolean(await db.prepare('SELECT id FROM profiles WHERE id=?').bind(bob).first()),'Expiry preserves unexpired posts');
  r=await call('/api/state','alice');check(r.data.own===null,'An expired post is no longer returned to its author');
  r=await call('/api/profile','alice','DELETE');check(r.status===200,'Deleting an already expired post is safe');
  r=await call('/api/profile','alice','POST',{...fixture('Test Alice','Shandilya'),publicationToken:expiredPublication});check(r.status===409,'A stale edit cannot republish a removed post');
  r=await call('/terms');check(r.status===200&&r.data.includes('डिस्क्लेमर')&&r.data.includes('छह कैलेंडर महीने')&&r.data.includes('अपनी पोस्ट कभी भी हटा सकता'),'Disclaimer includes lifetime and author deletion rules');
  r=await call('/');check(r.status===200&&r.data.includes('वैदिक मिलन')&&r.data.includes('100%')&&r.data.includes('संस्कारों से जुड़ें')&&r.data.includes('परंपरा के साथ।'),'Primary page server-renders the original free matrimonial experience');
  const disabled=new Miniflare({...config,bindings:{},d1Databases:{DB:'disabled-db'}});try{const disabledDb=await disabled.getD1Database('DB');for(const statement of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort().map(f=>readFileSync('drizzle/'+f,'utf8')).join(';').replaceAll('--> statement-breakpoint','').split(';').filter(s=>s.trim()))await disabledDb.prepare(statement).run();const response=await disabled.dispatchFetch('https://test.local/api/otp',{method:'POST',headers:{'oai-authenticated-user-id':'disabled-user','oai-authenticated-user-email':'disabled-user@test.invalid','content-type':'application/json'},body:JSON.stringify({action:'send',phone:'+919876543230'})});check(response.status===503,'Missing SMS credentials fail closed without sending fake OTPs');const state=await disabled.dispatchFetch('https://test.local/api/state');const data=await state.json();check(data.security.otpReady===false,'Unconfigured SMS status is explicit');const denied=await disabled.dispatchFetch('https://test.local/api/admin/profiles',{headers:{'oai-authenticated-user-id':'moderator','oai-authenticated-user-email':'moderator@test.invalid'}});check(denied.status===403,'Unconfigured admin allowlist fails closed');}finally{await disabled.dispose();}
  console.log('PASS: '+checks+' integration checks, including identity, consent, persistence, interests, message privacy, pagination, photo access and deletion.');
}finally{await mf.dispose();}

