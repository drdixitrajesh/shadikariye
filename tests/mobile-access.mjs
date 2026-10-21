import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createNodePortalRuntime} from './node-portal-runtime.mjs';

process.env.TRUST_CLOUDFLARE_PROXY='1';
const origin='https://vedik-milan.softinator.org';
const runtime=await createNodePortalRuntime({bindings:{STANDALONE_MODE:'test-portal',REQUIRE_ACCOUNT_MOBILE:'1',PUBLIC_REGISTRATION:'1',PORTAL_KEY:'a'.repeat(64),TURNSTILE_SECRET_KEY:'test'},outboundService:async()=>Response.json({success:true,action:'register',hostname:'vedik-milan.softinator.org',challenge_ts:new Date().toISOString()})});
let checks=0;
function eq(actual,expected){assert.deepEqual(actual,expected);checks++;}
async function call(path,{cookie,body,headers={},method}={}){return runtime.dispatchFetch(origin+path,{method:method??(body?'POST':'GET'),headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});}
try{
  const db=await runtime.getD1Database();
  for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())await db.exec(readFileSync('drizzle/'+file,'utf8'));
  const signup={username:'privacy.member',mobile:'9876543210',email:'',password:'A private member password 2026!',termsAccepted:true,turnstile:'test'};
  const registered=await call('/api/portal/register',{body:signup});eq(registered.status,201);
  const cookie=registered.headers.get('set-cookie').split(';')[0];
  const account=await db.prepare('SELECT id FROM portal_accounts WHERE username=?').bind(signup.username).first();
  const photoKey='12345678-1234-4234-8234-123456789012';
  await db.prepare("UPDATE profiles SET data=json_set(data,'$.publicListing',json('true'),'$.testAccount',json('false'),'$.approvalStatus','approved'),photo_key=? WHERE owner=(SELECT id FROM portal_accounts WHERE username='ananya.test')").bind(photoKey).run();
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJvYAAAAASUVORK5CYII=','base64');
  await db.prepare('INSERT INTO portal_photos(key,body,mime,size) VALUES(?,?,?,?)').bind(photoKey,image,'image/png',image.length).run();
  for(const path of ['/','/?community=Gaur','/admin','/portraits.png','/_next/image?url=%2Fapi%2Fphoto%2F'+photoKey]){
    const response=await call(path);eq(response.status,303);eq(response.headers.get('location'),'/login');eq(response.headers.get('cache-control'),'private, no-store');
  }
  for(const path of ['/api/state','/api/photo/'+photoKey,'/api/admin/members','/api/portal/admin/accounts']){
    const response=await call(path);eq(response.status,401);eq((await response.json()).code,'SIGN_IN_REQUIRED');
  }
  eq((await call('/api/state',{headers:{'oai-authenticated-user-id':account.id,'oai-authenticated-user-email':'admin@example.invalid'}})).status,401);
  eq((await call('/',{headers:{RSC:'1','Next-Router-Prefetch':'1'}})).status,303);
  for(const path of ['/login','/register','/terms','/account','/api/portal/me','/api/health'])eq((await call(path)).status,200);
  eq((await call('/api/state',{cookie})).status,200);
  eq((await call('/api/photo/'+photoKey,{cookie})).status,200);
  await db.prepare('UPDATE portal_accounts SET mobile=NULL WHERE id=?').bind(account.id).run();
  const legacyPage=await call('/',{cookie});eq(legacyPage.status,303);eq(legacyPage.headers.get('location'),'/account');
  for(const path of ['/api/state','/api/photo/'+photoKey,'/api/portal/admin/accounts'])eq((await call(path,{cookie})).status,403);
  eq((await call('/account',{cookie})).status,200);eq((await call('/api/portal/contact',{cookie})).status,200);
  const blocked=await call('/api/state',{cookie});eq((await blocked.json()).code,'MOBILE_REQUIRED');
  eq((await call('/api/portal/contact',{cookie,body:{mobile:signup.mobile,email:'',password:signup.password}})).status,200);
  eq((await call('/api/state',{cookie})).status,200);
  await db.prepare("UPDATE portal_accounts SET role='admin',mobile=NULL WHERE id=?").bind(account.id).run();
  await db.prepare('UPDATE portal_sessions SET mfa_verified=1 WHERE account_id=?').bind(account.id).run();
  eq((await call('/api/admin/members',{cookie})).status,403);
  eq((await call('/api/portal/admin/accounts',{cookie})).status,403);
  eq((await call('/api/portal/mfa',{cookie})).status,200);
  // Unset configuration stays closed; only legacy test fixtures opt out.
  delete globalThis[Symbol.for('managelove.node.env')].REQUIRE_ACCOUNT_MOBILE;
  eq((await call('/api/state')).status,401);
  console.log(`PASS: ${checks} mobile-access checks: anonymous pages/APIs/photos, RSC, image proxy, forged identity, legacy setup, admin, and fail-closed default.`);
}finally{await runtime.dispose();}
