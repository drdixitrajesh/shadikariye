import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash,createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
const require=createRequire(import.meta.url);
const nodeRuntime=process.env.PORTAL_TEST_RUNTIME==='node';
const {Miniflare}=nodeRuntime?{}:await import(require.resolve('miniflare',{paths:[realpathSync('node_modules/wrangler')]}));
const entry=resolve('dist/server/index.js');
function modules(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?modules(resolve(dir,f.name)):/\.m?js$/.test(f.name)?[{type:'ESModule',path:resolve(dir,f.name)}]:[]);}
const workerModules=modules(resolve('dist/server'));workerModules.sort((a,b)=>a.path===entry?-1:b.path===entry?1:0);
const origin='https://managelove.com';
const usernames=['drdixitrajesh','ananya.test','ishita.test','meera.test','aarav.test','rohan.test','aditya.test'];
const passwordFor=username=>'Fictional-portal-'+username+'-2026!';
const turnstileTokens=new Map();
let tokenSerial=0,checks=0;
function turnstile(action,overrides={}){
  const token='local-siteverify-'+(++tokenSerial);
  turnstileTokens.set(token,{success:true,action,hostname:'managelove.com',challenge_ts:new Date().toISOString(),...overrides});
  return token;
}
const runtimeOptions={
  modules:workerModules,modulesRoot:resolve('dist/server'),
  modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs']}],
  compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  d1Databases:{DB:'isolated-portal-db'},
  durableObjects:{PASSWORD_SERVICE:{className:'PortalPasswordService'}},
  bindings:{STANDALONE_MODE:'test-portal',PORTAL_KEY:'c18a0ee7f6b0d2149c7f4a63b1c42803122bb350b9a87651c8de2388e8f0af61',TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA'},
  outboundService:async request=>{
    assert.equal(request.url,'https://challenges.cloudflare.com/turnstile/v0/siteverify','Portal may call only the mocked Turnstile Siteverify service');
    assert.equal(request.method,'POST');
    const form=new URLSearchParams(await request.text());
    assert.equal(form.get('secret'),'1x0000000000000000000000000000000AA');
    const result=turnstileTokens.get(form.get('response'));
    turnstileTokens.delete(form.get('response'));
    return Response.json(result??{success:false,'error-codes':['invalid-input-response']});
  },
};
const mf=nodeRuntime?await (await import('./node-portal-runtime.mjs')).createNodePortalRuntime(runtimeOptions):new Miniflare(runtimeOptions);
function check(value,message){assert.ok(value,message);checks++;if(checks%20===0)console.log(checks+' portal checks passed');}
function equal(actual,expected,message){assert.equal(actual,expected,message);checks++;}
async function call(path,cookie=null,method='GET',data,extraHeaders={}){
  const headers=new Headers(extraHeaders);
  if(cookie)headers.set('cookie',cookie);
  if(method!=='GET'&&method!=='HEAD'&&!headers.has('origin'))headers.set('origin',origin);
  let body;
  if(data instanceof FormData){const encoded=new Request(origin+path,{method:'POST',body:data});body=await encoded.arrayBuffer();headers.set('content-type',encoded.headers.get('content-type'));}
  else if(data!==undefined){body=JSON.stringify(data);headers.set('content-type','application/json');}
  // An empty Origin explicitly tests that writes without an Origin fail closed.
  if(headers.get('origin')==='')headers.delete('origin');
  const response=await mf.dispatchFetch(origin+path,{method,headers,body});
  const contentType=response.headers.get('content-type')??'';
  return {status:response.status,headers:response.headers,data:contentType.includes('json')?await response.json():contentType.startsWith('image/')?Buffer.from(await response.arrayBuffer()):await response.text()};
}
function sessionCookie(response){
  const value=response.headers.get('set-cookie');
  check(Boolean(value?.startsWith('__Host-managelove=')),'Login sets the host-only portal cookie');
  check(/;\s*Secure(?:;|$)/i.test(value)&&/;\s*HttpOnly(?:;|$)/i.test(value),'Session cookie is Secure and HttpOnly');
  check(/;\s*SameSite=Strict(?:;|$)/i.test(value)&&/;\s*Path=\/(?:;|$)/i.test(value)&&!/(?:;|^)\s*Domain=/i.test(value),'Session cookie uses SameSite Strict, root path and no Domain');
  return value.split(';')[0];
}
function totp(secret,counter=Math.floor(Date.now()/30000)){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
  for(const char of secret.toUpperCase().replaceAll('=',''))bits+=alphabet.indexOf(char).toString(2).padStart(5,'0');
  const key=Buffer.from(Array.from({length:Math.floor(bits.length/8)},(_,i)=>parseInt(bits.slice(i*8,i*8+8),2)));
  const time=Buffer.alloc(8);time.writeBigUInt64BE(BigInt(counter));
  const digest=createHmac('sha1',key).update(time).digest();const offset=digest[digest.length-1]&15;
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
function profileBody(state,overrides={}){
  const p=state.own,privateData=state.ownPrivate;
  return {name:p.name,birthDate:privateData.birthDate,aadhaarLast4:privateData.aadhaarLast4,termsAccepted:true,references:[{name:'Fictional Reference One',relationship:'Fictional uncle',phone:'+919999999991',consent:true},{name:'Fictional Reference Two',relationship:'Fictional friend',phone:'+919999999992',consent:true}],age:p.age,gender:p.gender,community:p.community,gotra:p.gotra,city:p.city,education:p.education,profession:p.profession,height:p.height,maritalStatus:p.maritalStatus,about:p.about,managedBy:p.managedBy,language:p.language,consent:true,email:p.email??'',...overrides};
}
function photoForm(slot=0,size=0){
  // A real, Sharp-encoded 2×2 PNG exercises decoding and sanitization.
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP48OHDfxBmgDEAiNQPPY9NJdMAAAAASUVORK5CYII=','base64');
  const form=new FormData();form.set('slot',String(slot));form.set('photo',new File([size?Buffer.concat([bytes,Buffer.alloc(size-bytes.length)]):bytes],'fictional-test.png',{type:'image/png'}));return form;
}
try{
  const db=await mf.getD1Database('DB');
  for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const statement of readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint','').split(';').filter(s=>s.trim()))await db.prepare(statement).run();
  let r=await call('/api/portal/me');
  equal(r.status,200,'Portal session endpoint exists');equal(r.data.user,null,'Anonymous portal visitor has no session');
  check(Boolean(r.data.siteKey),'Portal exposes its public Turnstile site key');check(r.headers.get('cache-control')?.includes('no-store'),'Portal session response is never cached');
  const health=await call('/api/health');equal(health.data.mode,'test-portal','Deployment identifies the independent test portal mode');
  const accounts=new Map();const cookies=new Map();const states=new Map();const activationTokens=new Map();
  for(const username of usernames){
    const account=await db.prepare('SELECT * FROM portal_accounts WHERE username=?').bind(username).first();check(Boolean(account),'Seeded account exists for '+username);accounts.set(username,account);
    check(!account.password_hash,'Seeded accounts contain no preassigned or shared passwords');
    const token=randomBytes(32).toString('hex');activationTokens.set(username,token);
    await db.prepare('DELETE FROM portal_activations WHERE account_id=?').bind(account.id).run();
    await db.prepare('INSERT INTO portal_activations(id,account_id,token_hash,expires_at,used_at) VALUES(?,?,?,?,NULL)').bind(crypto.randomUUID(),account.id,createHash('sha256').update(token).digest('hex'),Date.now()+3600000).run();
  }
  const firstToken=activationTokens.get('ananya.test');
  r=await call('/api/portal/activate',null,'POST',{token:firstToken,password:passwordFor('ananya.test'),turnstile:turnstile('activate')},{origin:''});equal(r.status,403,'Activation requires Origin even with a valid token');
  r=await call('/api/portal/activate',null,'POST',{token:firstToken,password:'short',turnstile:turnstile('activate')});equal(r.status,400,'Activation rejects weak passwords');
  r=await call('/api/portal/activate',null,'POST',{token:firstToken,password:passwordFor('ananya.test'),turnstile:turnstile('login')});equal(r.status,403,'Activation rejects a Turnstile token from the login action');
  r=await call('/api/portal/activate',null,'POST',{token:firstToken,password:passwordFor('ananya.test'),turnstile:turnstile('activate',{hostname:'attacker.invalid'})});equal(r.status,403,'Activation rejects a challenge for another hostname');
  r=await call('/api/portal/activate',null,'POST',{token:firstToken,password:passwordFor('ananya.test')});equal(r.status,403,'Activation requires server verified Turnstile');
  for(const username of usernames){
    r=await call('/api/portal/activate',null,'POST',{token:activationTokens.get(username),password:passwordFor(username),turnstile:turnstile('activate')});equal(r.status,200,'Single-use activation succeeds for '+username);
    const stored=await db.prepare('SELECT password_hash FROM portal_accounts WHERE username=?').bind(username).first();
    const match=/^\$scrypt\$32768\$8\$3\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(stored.password_hash);check(Boolean(match),'Passwords use strong native scrypt and independent salts');
    const derived=scryptSync(passwordFor(username),match[1],64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
    check(timingSafeEqual(derived,Buffer.from(match[2],'hex')),'Stored scrypt verifier actually verifies the activated password');
    r=await call('/api/portal/login',null,'POST',{username,password:passwordFor(username),turnstile:turnstile('login')});equal(r.status,200,'Password login succeeds for '+username);const cookie=sessionCookie(r);cookies.set(username,cookie);
    const me=await call('/api/portal/me',cookie);equal(me.data.user.username,username,'A fresh request recognizes its own account');equal(me.data.user.id,accounts.get(username).id,'Session identity comes from the account');equal(me.data.user.role,username==='drdixitrajesh'?'admin':'member','Account role is enforced');
    const token=cookie.split('=')[1];const session=await db.prepare('SELECT token_hash FROM portal_sessions WHERE token_hash=?').bind(createHash('sha256').update(token).digest('hex')).first();
    check(Boolean(session)&&session.token_hash!==token,'Persistent sessions store a hash rather than the bearer cookie');
  }
  equal(new Set(cookies.values()).size,7,'All seven accounts have separate sessions');
  const verifiers=await db.prepare('SELECT password_hash FROM portal_accounts').all();
  equal(new Set(verifiers.results.map(a=>a.password_hash.split('$')[5])).size,7,'Each activated password has an independent random salt');
  r=await call('/api/portal/activate',null,'POST',{token:firstToken,password:'Replacement-password-2026!',turnstile:turnstile('activate')});check([400,401,409,410].includes(r.status),'Activation token cannot be reused');
  r=await call('/api/portal/login',null,'POST',{username:'ananya.test',password:'incorrect-password-2026!',turnstile:turnstile('login')});equal(r.status,401,'Wrong password is rejected');
  r=await call('/api/portal/login',null,'POST',{username:'ananya.test',password:passwordFor('ananya.test'),turnstile:turnstile('activate')});equal(r.status,403,'Login rejects the wrong Turnstile action');
  r=await call('/api/portal/login',null,'POST',{username:'ananya.test',password:passwordFor('ananya.test'),turnstile:turnstile('login',{hostname:'other.invalid'})});equal(r.status,403,'Login rejects another Turnstile hostname');
  r=await call('/api/portal/login',null,'POST',{username:'ananya.test',password:passwordFor('ananya.test'),turnstile:turnstile('login',{challenge_ts:new Date(Date.now()-600000).toISOString()})});equal(r.status,403,'Login rejects an expired Turnstile challenge');
  r=await call('/api/portal/login',null,'POST',{username:'ananya.test',password:passwordFor('ananya.test')});equal(r.status,403,'Login without Siteverify token is denied');
  const forged={'oai-authenticated-user-id':accounts.get('drdixitrajesh').id,'oai-authenticated-user-email':'drdixitrajesh@managelove.com'};
  r=await call('/api/portal/me',null,'GET',undefined,forged);equal(r.data.user,null,'Forged managed sign-in headers grant no portal session');
  for(const path of ['/api/admin/profiles','/api/portal/admin/accounts']){r=await call(path,null,'GET',undefined,forged);check([401,403].includes(r.status),'Forged headers cannot administer '+path);}
  r=await call('/api/state',null,'GET',undefined,forged);check(!r.data.isAdmin&&!r.data.own,'Forged headers do not confer a member identity');
  r=await call('/api/profile',null,'POST',{},forged);equal(r.status,401,'Forged headers cannot write profiles');
  r=await call('/api/portal/me',cookies.get('ananya.test'),'GET',undefined,forged);equal(r.data.user.role,'member','Forged admin headers cannot elevate an authenticated member');
  for(const username of usernames.slice(1)){
    const cookie=cookies.get(username);r=await call('/api/state',cookie);equal(r.status,200,'Member feed is available to '+username);states.set(username,r.data);
    check(Boolean(r.data.own)&&r.data.own.testAccount===true,'Each member owns a persistent labelled test profile');
    check(r.data.security.testAccess===true&&r.data.security.verified===false,'Test access is explicit without claiming mobile OTP verification');
    check(r.data.own.phoneVerified===false,'Test member does not display a false phone verified badge');
    check(r.data.ownPrivate.locked&&r.data.ownPrivate.references.length===2,'Own locked identity and two private references persist');
    check(!r.data.isAdmin,'Member role cannot administer the portal');
    check(r.data.profiles.filter(p=>p.id!==r.data.own.id).every(p=>!('references' in p)&&!('birthDate' in p)&&!('aadhaarLast4' in p)),'Other profiles expose no identity suffix, date of birth or references');
    r=await call('/api/portal/admin/accounts',cookie);equal(r.status,403,'Ordinary members cannot list or reset accounts');
  }
  const admin=cookies.get('drdixitrajesh'),alice=cookies.get('ananya.test'),bob=cookies.get('aarav.test'),charlie=cookies.get('aditya.test');
  r=await call('/api/admin/profiles',admin);check([401,403].includes(r.status),'Admin listing requires completed MFA');
  r=await call('/api/portal/admin/accounts',admin);equal(r.status,403,'Admin account management requires completed MFA');
  r=await call('/api/portal/admin/accounts',admin,'POST',{accountId:accounts.get('rohan.test').id,reason:'Fictional reset attempt before MFA'});equal(r.status,403,'Administrator password alone cannot reset members');
  r=await call('/api/portal/mfa',admin);equal(r.status,200,'Admin may obtain their enrollment challenge');check(/^[A-Z2-7]{16,}$/.test(r.data.secret)&&r.data.uri.startsWith('otpauth://totp/'),'MFA enrollment supplies a valid TOTP setup secret');const adminSecret=r.data.secret;
  let incorrectCode='000000';const currentCounter=Math.floor(Date.now()/30000);
  while([-1,0,1].some(offset=>totp(adminSecret,currentCounter+offset)===incorrectCode))incorrectCode=String((Number(incorrectCode)+1)%1000000).padStart(6,'0');
  r=await call('/api/portal/mfa',admin,'POST',{code:incorrectCode});check([400,401,403].includes(r.status),'Incorrect MFA code is rejected');
  const counter=Math.floor(Date.now()/30000),code=totp(adminSecret,counter);
  r=await call('/api/portal/mfa',admin,'POST',{code});equal(r.status,200,'A valid TOTP code enrolls the administrator');
  const mfaCookie=r.headers.get('set-cookie')?sessionCookie(r):admin;cookies.set('drdixitrajesh',mfaCookie);
  r=await call('/api/portal/me',mfaCookie);check(r.data.user.mfa===true,'MFA status is carried by the server session');
  r=await call('/api/portal/me',admin);equal(r.data.user,null,'MFA elevation rotates and revokes the password-only session');
  const encryptedMfa=await db.prepare('SELECT mfa_secret FROM portal_accounts WHERE username=?').bind('drdixitrajesh').first();
  check(encryptedMfa.mfa_secret!==adminSecret&&!encryptedMfa.mfa_secret.includes(adminSecret),'Persisted TOTP secret is encrypted');
  r=await call('/api/portal/mfa',mfaCookie,'POST',{code});check([400,401,403,409].includes(r.status),'A previously accepted TOTP code cannot be replayed');
  r=await call('/api/portal/admin/accounts',mfaCookie);equal(r.status,200,'MFA administrator can list portal accounts');equal(r.data.accounts.length,7,'Account list contains the administrator and six test members');
  check(r.data.accounts.every(a=>!('password_hash' in a)&&!('mfa_secret' in a)&&!('token_hash' in a)),'Account administration does not disclose password, TOTP or activation verifiers');
  r=await call('/api/admin/profiles',mfaCookie);equal(r.status,200,'Enrolled MFA administrator can list profiles');
  check(r.data.profiles.every(p=>!('references' in p)&&!('birthDate' in p)&&!('aadhaarLast4' in p)),'Admin catalog also excludes private identity and references');
  const aliceState=states.get('ananya.test'),bobState=states.get('aarav.test');const aliceId=aliceState.own.id,bobId=bobState.own.id;
  r=await call('/api/profile',alice,'POST',profileBody(aliceState,{city:'Pune'}),{origin:'https://attacker.invalid'});equal(r.status,403,'Cross-origin member write is rejected');
  r=await call('/api/profile',alice,'POST',profileBody(aliceState,{city:'Pune'}),{origin:''});equal(r.status,403,'Member write without Origin is rejected');
  r=await call('/api/profile',alice,'POST',profileBody(aliceState,{id:bobId,owner:accounts.get('aarav.test').id,city:'Pune',email:'  fictional.ananya@example.invalid  '}));equal(r.status,200,'Owner may edit mutable profile details');equal(r.data.profile.id,aliceId,'Client supplied identity cannot edit another account');equal(r.data.profile.city,'Pune','Mutable edit persists');equal(r.data.profile.email,'fictional.ananya@example.invalid','Consented contact email is trimmed');const expiry=r.data.profile.expiresAt;
  r=await call('/api/state',bob);equal(r.data.own.city,bobState.own.city,'An ownership forgery leaves the other member unchanged');equal(r.data.profiles.find(p=>p.id===aliceId)?.email,'fictional.ananya@example.invalid','Allowed member sees the consented contact email');
  r=await call('/api/profile',alice,'POST',profileBody(aliceState,{email:'broken-address'}));equal(r.status,400,'Invalid contact email is rejected');
  for(const changed of [{name:'Changed Fictional Identity'},{birthDate:'1990-01-01'},{aadhaarLast4:'9876'}]){r=await call('/api/profile',alice,'POST',profileBody(aliceState,changed));equal(r.status,409,'Locked identity cannot be changed through an edit');}
  r=await call('/api/profile',alice,'POST',profileBody(aliceState,{references:[]}));equal(r.status,400,'Profile edit still requires two consenting references');
  r=await call('/api/profile',alice,'POST',profileBody(aliceState,{aadhaarNumber:'123412341234'}));equal(r.status,400,'Full Aadhaar is rejected');
  r=await call('/api/profile',alice,'POST',profileBody(aliceState,{email:''}));equal(r.status,200,'Optional email can be cleared');equal(r.data.profile.expiresAt,expiry,'Editing does not extend publication lifetime');
  r=await call('/api/state',alice);equal(r.data.own.email,'','Cleared email persists across reads');
  r=await call('/api/state');check(!r.data.profiles.some(p=>p.id===aliceId||p.email==='fictional.ananya@example.invalid'),'Anonymous visitors cannot read real member email or member profile');
  r=await call('/api/actions',alice,'POST',{kind:'save',target:bobId,saved:true});equal(r.status,200,'Member can shortlist a member profile');
  r=await call('/api/state',alice);check(r.data.saved.includes(bobId),'Shortlist persists on a later request');
  r=await call('/api/actions',alice,'POST',{kind:'interest',target:bobId,message:'Hello from a fictional test member'});equal(r.status,200,'Member may send an interest');
  r=await call('/api/state',bob);const interest=r.data.received.find(i=>i.sender_profile===aliceId);check(Boolean(interest),'Correct recipient sees the persisted interest');const thread=interest.id;
  r=await call('/api/messages',alice,'POST',{thread,body:'Before acceptance'});equal(r.status,403,'Messages require accepted interest');
  r=await call('/api/actions',alice,'PATCH',{id:thread,status:'accepted'});equal(r.status,404,'Sender cannot accept on behalf of recipient');
  r=await call('/api/actions',bob,'PATCH',{id:thread,status:'accepted'});equal(r.status,200,'Recipient may accept an interest');
  r=await call('/api/messages',alice,'POST',{thread,body:'Hello Aarav'});equal(r.status,200,'Accepted sender may send private messages');
  r=await call('/api/messages',bob,'POST',{thread,body:'Hello Ananya'});equal(r.status,200,'Accepted recipient may reply');
  r=await call('/api/messages?thread='+thread,bob);check(r.status===200&&r.data.messages.length===2&&r.data.messages.some(m=>m.body==='Hello Ananya'&&m.mine),'A fresh read preserves message text and sender attribution');
  r=await call('/api/messages?thread='+thread,charlie);equal(r.status,403,'Unrelated member cannot read the private conversation');
  r=await call('/api/messages',charlie,'POST',{thread,body:'Unrelated write'});equal(r.status,403,'Unrelated member cannot write to the private conversation');
  r=await call('/api/photo',alice,'POST',photoForm(0,256*1024+1));check([400,413].includes(r.status),'Photo larger than 256 KiB is rejected');
  const photos=[];
  for(let slot=0;slot<5;slot++){r=await call('/api/photo',alice,'POST',photoForm(slot));equal(r.status,200,'Photo slot '+slot+' persists');photos.push(r.data.photoKey);}
  const storedPhotos=await db.prepare('SELECT key,size,body FROM portal_photos').all();
  equal(storedPhotos.results.length,5,'All five uploaded photo bodies persist in private D1 storage without an R2 binding');
  check(storedPhotos.results.every(p=>p.size>0&&p.size<=256*1024),'Persisted photo bodies remain within the per-photo limit');
  const corruptPhoto=new FormData();corruptPhoto.set('photo',new File([Buffer.from([0xff,0xd8,0xff,0x00,0,0,0,0,0,0,0,0])],'corrupt.jpg',{type:'image/jpeg'}));
  r=await call('/api/photo',alice,'POST',corruptPhoto);equal(r.status,400,'A forged image signature cannot replace a stored photo');
  const usedBytes=await db.prepare('SELECT COALESCE(SUM(size),0) AS bytes FROM portal_photos').first();
  // SQLite creates placeholder bodies locally; every row obeys the size limit.
  let remainingBytes=40*1024*1024-usedBytes.bytes;const quotaFixtures=[];
  for(let i=0;remainingBytes>0;i++){const size=Math.min(256*1024,remainingBytes);quotaFixtures.push(db.prepare('INSERT INTO portal_photos(key,body,mime,size) VALUES(?,zeroblob(?),?,?)').bind('quota-fixture-'+i,size,'image/png',size));remainingBytes-=size;}
  for(let start=0;start<quotaFixtures.length;start+=50)await db.batch(quotaFixtures.slice(start,start+50));
  r=await call('/api/photo',alice,'POST',photoForm(0));equal(r.status,413,'A full private photo store rejects further uploads');
  await db.prepare("DELETE FROM portal_photos WHERE key LIKE 'quota-fixture-%'").run();
  r=await call('/api/state',alice);equal(r.data.own.photoKeys[0],photos[0],'A quota failure preserves the existing photo');
  r=await call('/api/photo',alice,'POST',photoForm(5));equal(r.status,400,'Sixth photo is rejected');
  r=await call('/api/state',alice);equal(r.data.own.photoKeys.length,5,'All five private photo slots survive a fresh read');
  r=await call('/api/photo/'+photos[0]);equal(r.status,401,'Anonymous visitors cannot download private photos');
  r=await call('/api/photo/'+photos[0],bob);equal(r.status,200,'An allowed member may read a member photo');check(r.headers.get('cache-control')?.includes('private')&&r.headers.get('cache-control')?.includes('no-store'),'Private photos are never publicly cached');
  equal(r.headers.get('content-type'),'image/png','Private photo response preserves a safe image type');
  check(r.data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Private photo response contains the actual stored image bytes');
  await db.prepare('DELETE FROM daily_views WHERE owner=? AND target=?').bind(accounts.get('aditya.test').id,aliceId).run();
  r=await call('/api/photo/'+photos[0],charlie);equal(r.status,403,'A private photo URL cannot bypass profile view allowance');
  const replacements=await Promise.all(Array.from({length:12},()=>call('/api/photo',alice,'POST',photoForm(2))));
  check(replacements.every(result=>[200,409].includes(result.status)),'Concurrent replacements either commit or report a profile conflict');
  check(replacements.some(result=>result.status===200),'At least one concurrent same-slot replacement succeeds');
  const orphaned=await db.prepare('SELECT COUNT(*) AS n FROM portal_photos WHERE key NOT IN (SELECT key FROM profile_photos) AND key NOT IN (SELECT photo_key FROM profiles WHERE photo_key IS NOT NULL)').first();
  equal(orphaned.n,0,'Concurrent same-slot replacements leave no orphaned private photo bodies');
  const bodies=await db.prepare('SELECT COUNT(*) AS n FROM portal_photos').first();
  const referencedBodies=await db.prepare('SELECT COUNT(DISTINCT key) AS n FROM profile_photos').first();
  equal(bodies.n,referencedBodies.n,'Every private photo body is referenced after concurrent replacement');
  r=await call('/api/state',alice);equal(r.data.own.photoKeys.length,5,'Concurrent replacement preserves the five existing photo slots');
  photos[2]=r.data.own.photoSlots.find(slot=>slot.slot===2).key;
  check(replacements.some(result=>result.status===200&&result.data.photoKey===photos[2]),'The final photo slot references a successfully committed replacement');
  const oversizedMultipart=photoForm(2);oversizedMultipart.set('junk','x'.repeat(300000));
  r=await call('/api/photo',alice,'POST',oversizedMultipart);equal(r.status,413,'Multipart size cap rejects oversized extra fields even without Content-Length');
  r=await call('/api/state',alice);equal(r.data.own.photoSlots.find(slot=>slot.slot===2).key,photos[2],'Rejected oversized multipart preserves the previously committed photo');
  const bodiesAfterRejection=await db.prepare('SELECT COUNT(*) AS n FROM portal_photos').first();equal(bodiesAfterRejection.n,5,'Rejected oversized multipart leaves no new stored photo body');
  r=await call('/api/photo?slot=4',alice,'DELETE');equal(r.status,200,'Owner may remove a photo slot');
  r=await call('/api/photo/'+photos[4],alice);equal(r.status,404,'Removed photo has no readable endpoint');equal(await db.prepare('SELECT key FROM portal_photos WHERE key=?').bind(photos[4]).first(),null,'Removed photo body is deleted from private D1 storage');
  const synthetic=[];
  for(let i=0;i<25;i++)synthetic.push(db.prepare('INSERT INTO profiles(id,owner,data,updated_at,published_at,expires_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),'quota-fictional-'+i,JSON.stringify({...profileBody(aliceState),name:'Fictional Quota Member '+i,testAccount:true}),Date.now()+i+1000,Date.now(),Date.now()+86400000));
  await db.batch(synthetic);
  r=await call('/api/state',charlie);equal(r.data.quota.used,20,'Member profile viewing stops at the twenty profile allowance');
  const visibleIds=r.data.profiles.map(p=>p.id);
  r=await call('/api/state',charlie);equal(r.data.quota.used,20,'Refreshing does not increase the allowance');check(r.data.profiles.every(p=>p.id===r.data.own.id||visibleIds.includes(p.id)),'Refreshing cannot reveal an additional profile after reaching the allowance');
  const removal={id:bobId,confirmation:bobState.own.name,reason:'Fictional account removed during integration review'};
  r=await call('/api/admin/profiles',alice,'DELETE',removal);equal(r.status,403,'Member cannot delete another profile through moderation');
  r=await call('/api/admin/profiles',mfaCookie,'DELETE',removal,{origin:'https://attacker.invalid'});equal(r.status,403,'Admin deletion requires the canonical Origin');
  r=await call('/api/admin/profiles',mfaCookie,'DELETE',{...removal,confirmation:'Wrong fictional name'});equal(r.status,400,'Admin removal requires matching confirmation');
  r=await call('/api/admin/profiles',mfaCookie,'DELETE',removal);check(r.status===200&&r.data.deleted,'MFA administrator may delete the selected profile');
  equal(await db.prepare('SELECT id FROM profiles WHERE id=?').bind(bobId).first(),null,'Admin removal deletes only the selected profile');
  r=await call('/api/messages?thread='+thread,alice);check([403,404].includes(r.status),'Deleting a participant removes the private conversation');
  const audit=await db.prepare('SELECT actor,reason FROM admin_actions WHERE target=?').bind(bobId).first();equal(audit.actor,accounts.get('drdixitrajesh').id,'Moderation audit actor comes from the MFA session');equal(audit.reason,removal.reason,'Moderation audit preserves its reason');
  r=await call('/api/profile',alice,'DELETE');equal(r.status,200,'Owner may delete their own profile');
  equal(await db.prepare('SELECT owner FROM profile_private WHERE owner=?').bind(accounts.get('ananya.test').id).first(),null,'Owner deletion removes private reference data');
  for(const photo of photos)equal(await db.prepare('SELECT key FROM portal_photos WHERE key=?').bind(photo).first(),null,'Owner deletion removes uploaded photo bodies');
  r=await call('/api/profile',alice,'POST',profileBody(aliceState,{name:'Different Identity After Deletion'}));equal(r.status,409,'Deletion cannot evade permanent identity locking');
  r=await call('/api/profile',alice,'POST',profileBody(aliceState));equal(r.status,200,'Owner can republish with the retained identity');equal(r.data.profile.id,aliceId,'Republishing retains stable profile identity');const publication=r.data.profile.publishedAt;
  r=await call('/api/photo',alice,'POST',photoForm());equal(r.status,200,'Republished profile may have a new photo');const expiredPhoto=r.data.photoKey;
  await db.prepare('UPDATE profiles SET expires_at=? WHERE id=?').bind(Date.now()-1,aliceId).run();
  r=await call('/api/photo/'+expiredPhoto,alice);equal(r.status,404,'Expired publication photo is no longer readable');
  equal(await db.prepare('SELECT id FROM profiles WHERE id=?').bind(aliceId).first(),null,'Expiry removes the published profile');
  equal(await db.prepare('SELECT owner FROM profile_private WHERE owner=?').bind(accounts.get('ananya.test').id).first(),null,'Expiry removes private references');
  equal(await db.prepare('SELECT key FROM portal_photos WHERE key=?').bind(expiredPhoto).first(),null,'Expiry removes the stored photo body');
  check(Boolean(await db.prepare('SELECT owner FROM identity_locks WHERE owner=?').bind(accounts.get('ananya.test').id).first()),'Expiry retains permanent identity locking');
  r=await call('/api/profile',alice,'POST',profileBody(aliceState,{publicationToken:publication}));equal(r.status,409,'An edit of an expired publication cannot republish it');
  const resetRequest={accountId:accounts.get('rohan.test').id,reason:'Fictional account access reset during integration review'};
  r=await call('/api/portal/admin/accounts',charlie,'POST',resetRequest);equal(r.status,403,'Ordinary members cannot reset another account');
  r=await call('/api/portal/admin/accounts',mfaCookie,'POST',resetRequest,{origin:''});equal(r.status,403,'Account reset requires a canonical Origin');
  r=await call('/api/portal/admin/accounts',mfaCookie,'POST',{...resetRequest,accountId:accounts.get('drdixitrajesh').id});equal(r.status,403,'Administrator cannot reset their own account to evade MFA');
  r=await call('/api/portal/admin/accounts',mfaCookie,'POST',resetRequest);equal(r.status,200,'MFA administrator can reset a member account');
  const activationUrl=new URL(r.data.activationUrl,origin),resetToken=activationUrl.hash.slice(1);check(Boolean(resetToken)&&r.data.expiresAt>Date.now(),'Reset returns a short-lived single-use activation URL');
  equal(activationUrl.search,'','Activation secret is carried in the URL fragment rather than a server query');
  r=await call('/api/portal/me',cookies.get('rohan.test'));equal(r.data.user,null,'Reset revokes the member previous session immediately');
  const resetRecord=await db.prepare('SELECT token_hash FROM portal_activations WHERE account_id=? AND used_at IS NULL').bind(accounts.get('rohan.test').id).first();
  equal(resetRecord.token_hash,createHash('sha256').update(resetToken).digest('hex'),'Activation storage retains only a hash of the reset token');
  await db.prepare('UPDATE portal_activations SET expires_at=0 WHERE account_id=? AND used_at IS NULL').bind(accounts.get('rohan.test').id).run();
  r=await call('/api/portal/activate',null,'POST',{token:resetToken,password:'New-fictional-rohan-password-2026!',turnstile:turnstile('activate')});check([400,401,410].includes(r.status),'An expired activation link cannot set a password (HTTP '+r.status+', '+JSON.stringify(r.data)+')');
  const logoutCookie=cookies.get('ishita.test');
  r=await call('/api/portal/logout',logoutCookie,'POST',{}, {origin:''});equal(r.status,403,'Logout without Origin is rejected');
  r=await call('/api/portal/me',logoutCookie);check(Boolean(r.data.user),'A rejected cross-origin logout keeps its session');
  r=await call('/api/portal/logout',logoutCookie,'POST',{});equal(r.status,200,'Logout revokes the current session');
  r=await call('/api/portal/me',logoutCookie);equal(r.data.user,null,'A copied logged out cookie no longer authenticates');
  const revoked=cookies.get('meera.test');await db.prepare('UPDATE portal_accounts SET session_version=session_version+1 WHERE username=?').bind('meera.test').run();
  r=await call('/api/portal/me',revoked);equal(r.data.user,null,'Account version change revokes existing sessions');
  const expiringCookie=cookies.get('aditya.test');
  await db.prepare('UPDATE portal_sessions SET expires_at=0 WHERE token_hash=?').bind(createHash('sha256').update(expiringCookie.split('=')[1]).digest('hex')).run();
  r=await call('/api/portal/me',expiringCookie);equal(r.data.user,null,'Expired session cookies cannot authenticate');
  r=await call('/api/portal/me','__Host-managelove=forged-session-token');equal(r.data.user,null,'Forged cookie cannot authenticate');
  // Repeated failures use an account-independent bucket and never touch real services.
  let throttled=false;
  for(let i=0;i<20;i++){r=await call('/api/portal/login',null,'POST',{username:'nonexistent.fictional.account',password:'Invalid-fictional-password-2026!',turnstile:turnstile('login')});if(r.status===429){throttled=true;break;}equal(r.status,401,'Unknown account login gives the same denied response');}
  check(throttled,'Repeated login failures are rate limited');
  console.log('PASS: '+checks+' independent portal checks including activation, scrypt, cookie sessions, MFA, privacy, persistent member actions, private photos, moderation and expiry.');
}finally{await mf.dispose();}
