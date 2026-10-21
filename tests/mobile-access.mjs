import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createNodePortalRuntime} from './node-portal-runtime.mjs';
import sharp from 'sharp';

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
  await db.prepare("UPDATE profiles SET data=json_set(data,'$.publicListing',json('true'),'$.testAccount',json('false'),'$.approvalStatus','approved','$.email','private@example.invalid'),photo_key=? WHERE owner=(SELECT id FROM portal_accounts WHERE username='ananya.test')").bind(photoKey).run();
  const target=await db.prepare('SELECT id FROM profiles WHERE photo_key=?').bind(photoKey).first();
  const image=await sharp({create:{width:600,height:800,channels:3,background:'#cab8a8'}}).png().toBuffer();
  await db.prepare('INSERT INTO portal_photos(key,body,mime,size) VALUES(?,?,?,?)').bind(photoKey,image,'image/png',image.length).run();
  for(const path of ['/','/?community=Gaur','/portraits.png','/login','/register','/terms','/account','/api/portal/me','/api/health'])eq((await call(path)).status,200);
  const rsc=await call('/',{headers:{RSC:'1','Next-Router-Prefetch':'1'}});eq(rsc.status!==303,true);eq(rsc.headers.get('location')==='/login',false);
  const publicState=await (await call('/api/state')).json();
  eq(publicState.profiles.length,1);eq(publicState.profiles[0].id,target.id);
  for(const key of ['email','birthDate','references','reviewToken','reviewReason','owner'])eq(key in publicState.profiles[0],false);
  eq(publicState.own,null);eq(publicState.saved,[]);eq(publicState.sent,[]);eq(publicState.received,[]);eq('ownPrivate' in publicState,false);eq(publicState.isAdmin,false);
  eq((await call('/admin')).status,303);
  for(const path of ['/api/admin/members','/api/portal/admin/accounts','/api/messages'])eq((await call(path)).status,401);
  for(const path of ['/api/profile','/api/actions','/api/messages','/api/photo'])eq((await call(path,{body:{}})).status,401);
  const forged=await call('/api/state',{headers:{'oai-authenticated-user-id':account.id,'oai-authenticated-user-email':'admin@example.invalid'}});eq((await forged.json()).own,null);
  const publicPhoto=await call('/api/photo/'+photoKey);eq(publicPhoto.status,200);eq(publicPhoto.headers.get('x-photo-protection'),'watermark-v1');eq(publicPhoto.headers.get('content-type'),'image/jpeg');
  const markedPublic=Buffer.from(await publicPhoto.arrayBuffer());eq(markedPublic.equals(image),false);
  const markedPhoto=await call('/api/photo/'+photoKey,{cookie});eq(markedPhoto.status,200);
  const marked=Buffer.from(await markedPhoto.arrayBuffer());eq(marked.equals(markedPublic),false);
  const rawAttempt=await call('/api/photo/'+photoKey+'?raw=1&download=1');eq(rawAttempt.headers.get('x-photo-protection'),'watermark-v1');eq(Buffer.from(await rawAttempt.arrayBuffer()).equals(markedPublic),true);
  const source=await db.prepare('SELECT body FROM portal_photos WHERE key=?').bind(photoKey).first('body');eq(Buffer.from(source).equals(image),true);
  const protection=globalThis[Symbol.for('managelove.node.env')].PHOTO_PROTECTION;delete globalThis[Symbol.for('managelove.node.env')].PHOTO_PROTECTION;
  eq((await call('/api/photo/'+photoKey)).status,503);
  globalThis[Symbol.for('managelove.node.env')].PHOTO_PROTECTION=protection;
  for(const [field,value] of [['publicListing',false],['approvalStatus','pending'],['approvalStatus','rejected'],['testAccount',true]]){
    const before=await db.prepare('SELECT data FROM profiles WHERE id=?').bind(target.id).first('data');const data=JSON.parse(before);data[field]=value;
    await db.prepare('UPDATE profiles SET data=? WHERE id=?').bind(JSON.stringify(data),target.id).run();
    eq((await call('/api/photo/'+photoKey)).status,401);eq((await (await call('/api/state')).json()).profiles.some(p=>p.id===target.id),false);
    await db.prepare('UPDATE profiles SET data=? WHERE id=?').bind(before,target.id).run();
  }
  const template=await db.prepare('SELECT data FROM profiles WHERE id=?').bind(target.id).first('data');
  const extraIds=[];
  for(let i=0;i<21;i++){const id=crypto.randomUUID();extraIds.push(id);await db.prepare('INSERT INTO profiles(id,owner,data,updated_at,published_at,expires_at) VALUES(?,?,?,?,?,?)').bind(id,id,template,Date.now(),Date.now(),Date.now()+86400000).run();}
  eq((await (await call('/api/state')).json()).profiles.length,22);
  for(const id of extraIds)await db.prepare('DELETE FROM profiles WHERE id=?').bind(id).run();
  await db.prepare('UPDATE portal_accounts SET mobile=NULL WHERE id=?').bind(account.id).run();
  eq((await call('/',{cookie})).status,200);
  const legacy=await (await call('/api/state',{cookie})).json();eq(legacy.own,null);eq('ownPrivate' in legacy,false);eq(legacy.profiles[0].id,target.id);
  eq((await call('/api/photo/'+photoKey,{cookie})).status,200);
  eq((await call('/api/profile',{cookie,body:{}})).status,403);
  eq((await call('/api/portal/contact',{cookie,body:{mobile:signup.mobile,email:'',password:signup.password}})).status,200);
  eq((await call('/api/state',{cookie})).status,200);
  await db.prepare("UPDATE portal_accounts SET role='admin',mobile=NULL WHERE id=?").bind(account.id).run();
  await db.prepare('UPDATE portal_sessions SET mfa_verified=1 WHERE account_id=?').bind(account.id).run();
  eq((await call('/api/admin/members',{cookie})).status,403);eq((await call('/api/portal/admin/accounts',{cookie})).status,403);eq((await call('/api/portal/mfa',{cookie})).status,200);
  delete globalThis[Symbol.for('managelove.node.env')].REQUIRE_ACCOUNT_MOBILE;
  eq((await call('/api/profile',{body:{}})).status,401);eq((await call('/api/photo/'+photoKey)).headers.get('x-photo-protection'),'watermark-v1');
  console.log(`PASS: ${checks} public-browsing checks: consent, moderation, private fields, photo watermarks, original protection, forged identity and member/mobile gates.`);
}finally{await runtime.dispose();}
