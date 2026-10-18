import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createNodePortalRuntime} from './node-portal-runtime.mjs';
// Match the production tunnel boundary so independent client IPs stay distinct.
process.env.TRUST_CLOUDFLARE_PROXY='1';
let serial=0;
const runtime=await createNodePortalRuntime({bindings:{STANDALONE_MODE:'test-portal',PUBLIC_REGISTRATION:'1',PORTAL_KEY:'a'.repeat(64),TURNSTILE_SITE_KEY:'test',TURNSTILE_SECRET_KEY:'test'},outboundService:async request=>{
  assert.equal(new URL(request.url).hostname,'challenges.cloudflare.com');
  const token=(await request.formData()).get('response');
  return Response.json({success:token==='register-ok'||token==='login-ok',action:token==='login-ok'?'login':'register',hostname:'managelove.com',challenge_ts:new Date().toISOString()});
}});
async function call(path,body,cookie,ip='registration-'+(++serial)){
  const response=await runtime.dispatchFetch('https://managelove.com'+path,{method:body?'POST':'GET',headers:{Origin:'https://managelove.com','Content-Type':'application/json','CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
try{
  const db=await runtime.getD1Database();
  for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint','').split(';').filter(x=>x.trim()))await db.prepare(sql).run();
  const signup={username:'new.member2026',password:'A strong member password 2026!',termsAccepted:true,turnstile:'register-ok',role:'admin',testAccount:true};
  assert.equal((await call('/api/portal/register',{...signup,termsAccepted:false})).status,400);
  assert.equal((await call('/api/portal/register',{...signup,password:'short'})).status,400);
  assert.equal((await call('/api/portal/register',{...signup,username:'invalid name'})).status,400);
  assert.equal((await call('/api/portal/register',{...signup,turnstile:'login-ok'})).status,403);
  assert.equal((await call('/api/portal/register',{...signup,username:'drdixitrajesh'})).status,409);
  assert.equal((await db.prepare("SELECT role,status FROM portal_accounts WHERE username='drdixitrajesh'").first()).status,'invited');
  const rejected=await runtime.dispatchFetch('https://managelove.com/api/portal/register',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify(signup)});
  assert.equal(rejected.status,403);
  const registered=await call('/api/portal/register',signup);
  assert.equal(registered.status,201);assert.ok(registered.cookie?.startsWith('__Host-managelove='));
  const account=await db.prepare('SELECT role,test_account,password_hash,status FROM portal_accounts WHERE username=?').bind(signup.username).first();
  assert.equal(account.role,'member');assert.equal(account.test_account,0);assert.equal(account.status,'active');assert.ok(account.password_hash.startsWith('$scrypt$'));
  assert.equal((await call('/api/portal/register',{...signup,password:'Different password 2026!'})).status,409);
  assert.equal((await db.prepare('SELECT password_hash FROM portal_accounts WHERE username=?').bind(signup.username).first()).password_hash,account.password_hash);
  const state=await call('/api/state',null,registered.cookie);
  assert.equal(state.data.security.canPublish,true);assert.equal(state.data.security.verified,false);assert.equal(state.data.security.testAccess,false);
  assert.equal((await call('/api/portal/admin/accounts',null,registered.cookie)).status,403);
  const profile={name:'New Member',birthDate:'1996-04-15',aadhaarLast4:'',termsAccepted:true,references:[{name:'Reference One',relationship:'Uncle',phone:'+919999999991',consent:true},{name:'Reference Two',relationship:'Friend',phone:'+919999999992',consent:true}],gender:'male',community:'Gaur',gotra:'Shandilya',city:'Indore',education:'Graduate',profession:'Engineer',height:175,maritalStatus:'Never married',about:'A new member looking for a compatible partner.',managedBy:'Self',language:'Hindi',consent:true};
  assert.equal((await call('/api/profile',{...profile,consent:false},registered.cookie)).status,400);
  const published=await call('/api/profile',profile,registered.cookie);
  assert.equal(published.status,200);assert.equal(published.data.profile.testAccount,false);assert.equal(published.data.profile.portrait,null);
  const memberState=await call('/api/state',null,registered.cookie);
  assert.equal(memberState.data.own.name,'New Member');assert.equal(memberState.data.own.phoneVerified,false);
  assert.equal(memberState.data.own.publicListing,false);
  const photoKey=crypto.randomUUID(),image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJvYAAAAASUVORK5CYII=','base64');
  await db.prepare('INSERT INTO portal_photos(key,body,mime,size) VALUES(?,?,?,?)').bind(photoKey,image,'image/png',image.length).run();
  await db.prepare('INSERT INTO profile_photos(profile_id,slot,key) VALUES(?,0,?)').bind(published.data.profile.id,photoKey).run();
  await db.prepare('UPDATE profiles SET photo_key=? WHERE id=?').bind(photoKey,published.data.profile.id).run();
  async function anonymousPhoto(){return runtime.dispatchFetch('https://managelove.com/api/photo/'+photoKey);}
  assert.equal((await anonymousPhoto()).status,401);
  assert.equal((await call('/api/state')).data.profiles.some(p=>p.id===published.data.profile.id),false);
  assert.equal((await call('/api/profile',{...profile,publicListing:'yes'},registered.cookie)).status,400);
  const optedIn=await call('/api/profile',{...profile,publicListing:true,email:'private-contact@example.invalid'},registered.cookie);
  assert.equal(optedIn.status,200);assert.equal(optedIn.data.profile.publicListing,true);assert.equal(optedIn.data.profile.expiresAt,published.data.profile.expiresAt);
  const publicState=await call('/api/state'),publicProfile=publicState.data.profiles.find(p=>p.id===published.data.profile.id);
  assert.ok(publicProfile);assert.equal(publicProfile.name,'New Member');assert.equal(publicProfile.photoKeys[0],photoKey);assert.equal('email' in publicProfile,false);
  for(const privateValue of ['private-contact@example.invalid','1996-04-15','+919999999991','Reference One'])assert.equal(JSON.stringify(publicState.data).includes(privateValue),false);
  const publicPhoto=await anonymousPhoto();assert.equal(publicPhoto.status,200);assert.equal(publicPhoto.headers.get('content-type'),'image/png');assert.match(publicPhoto.headers.get('cache-control'),/no-store/);
  const regularEdit=await call('/api/profile',{...profile,city:'Bhopal'},registered.cookie);assert.equal(regularEdit.data.profile.publicListing,true);
  await db.prepare("UPDATE profiles SET data=json_set(data,'$.testAccount',1) WHERE id=?").bind(published.data.profile.id).run();
  assert.equal((await anonymousPhoto()).status,401);assert.equal((await call('/api/state')).data.profiles.some(p=>p.id===published.data.profile.id),false);
  const optedOut=await call('/api/profile',{...profile,publicListing:false},registered.cookie);assert.equal(optedOut.data.profile.publicListing,false);
  assert.equal((await anonymousPhoto()).status,401);assert.equal((await call('/api/state')).data.profiles.some(p=>p.id===published.data.profile.id),false);
  assert.equal((await call('/api/portal/logout',{},registered.cookie)).status,200);
  assert.equal((await call('/api/portal/login',{username:signup.username,password:signup.password,turnstile:'login-ok'})).status,200);
  for(let n=0;n<5;n++)assert.equal((await call('/api/portal/register',{...signup,username:'limited'+n},null,'same-registration-ip')).status,201);
  assert.equal((await call('/api/portal/register',{...signup,username:'limited6'},null,'same-registration-ip')).status,429);
  const racing=await Promise.all([call('/api/portal/register',{...signup,username:'concurrent.member'}),call('/api/portal/register',{...signup,username:'concurrent.member'})]);
  assert.deepEqual(racing.map(r=>r.status).sort(),[201,409]);
  globalThis[Symbol.for('managelove.node.env')].PUBLIC_REGISTRATION='0';
  assert.equal((await call('/api/portal/register',{...signup,username:'closed.member'})).status,404);
  console.log('PASS: public signup, consent, challenge, role safety, duplicate preservation, sessions, publishing, provenance and rate limits.');
}finally{await runtime.dispose();}
