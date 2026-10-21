import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {createNodePortalRuntime} from './node-portal-runtime.mjs';

process.env.TRUST_CLOUDFLARE_PROXY='1';
const origin='https://vedik-milan.softinator.org';
const runtime=await createNodePortalRuntime({bindings:{STANDALONE_MODE:'test-portal',REQUIRE_ACCOUNT_MOBILE:'1',PUBLIC_REGISTRATION:'1',PORTAL_KEY:'a'.repeat(64),TURNSTILE_SITE_KEY:'test',TURNSTILE_SECRET_KEY:'test'},outboundService:async request=>{
  const token=(await request.formData()).get('response');
  return Response.json({success:['register','recover','activate','login'].includes(token),action:token,hostname:'vedik-milan.softinator.org',challenge_ts:new Date().toISOString()});
}});
let checks=0,serial=0;
function eq(actual,expected){assert.deepEqual(actual,expected);checks++;}
async function call(path,body,cookie,requestOrigin=origin){const response=await runtime.dispatchFetch(origin+path,{method:body?'POST':'GET',headers:{Origin:requestOrigin,'Content-Type':'application/json','CF-Connecting-IP':'recovery-'+(++serial),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
try{
  const db=await runtime.getD1Database();
  for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())await db.exec(readFileSync('drizzle/'+file,'utf8'));
  const signup={username:'recovery.member',mobile:'9876543210',email:'private@example.invalid',password:'Original member password 2026!',termsAccepted:true,turnstile:'register'};
  const member=await call('/api/portal/register',signup);eq(member.status,201);
  const original=await db.prepare('SELECT id,password_hash FROM portal_accounts WHERE username=?').bind(signup.username).first();
  const adminId=await db.prepare("SELECT id FROM portal_accounts WHERE role='admin' LIMIT 1").first('id');
  await db.prepare("UPDATE portal_accounts SET status='active',mobile='+919876543211' WHERE id=?").bind(adminId).run();
  async function adminSession(mfa){const token=randomBytes(32).toString('hex');await db.prepare('INSERT INTO portal_sessions(token_hash,account_id,session_version,mfa_verified,created_at,expires_at) VALUES(?,?,0,?,?,?)').bind(createHash('sha256').update(token).digest('hex'),adminId,mfa?1:0,Date.now(),Date.now()+3600000).run();return '__Host-managelove='+token;}
  const admin=await adminSession(true),passwordOnlyAdmin=await adminSession(false);
  eq((await runtime.dispatchFetch(origin+'/forgot-password')).status,200);
  eq((await call('/api/portal/recover',{identifier:signup.mobile,turnstile:'recover'},null,'https://evil.example')).status,403);
  eq((await call('/api/portal/recover',{identifier:signup.mobile,turnstile:'invalid'})).status,403);
  eq((await call('/api/portal/recover',{identifier:'',turnstile:'recover'})).status,400);
  const unknown=await call('/api/portal/recover',{identifier:'unknown.member',turnstile:'recover'});eq(unknown.status,202);
  const known=await call('/api/portal/recover',{identifier:signup.mobile,turnstile:'recover'});eq(known.status,202);eq(known.data,unknown.data);
  eq((await db.prepare('SELECT password_hash FROM portal_accounts WHERE id=?').bind(original.id).first()).password_hash,original.password_hash);
  eq((await call('/api/portal/me',null,member.cookie)).data.user.username,signup.username);
  eq((await call('/api/portal/admin/accounts')).status,401);
  eq((await call('/api/portal/admin/accounts',null,member.cookie)).status,403);
  eq((await call('/api/portal/admin/accounts',null,passwordOnlyAdmin)).status,403);
  const queue=(await call('/api/portal/admin/accounts',null,admin)).data.recoveryRequests;
  eq(queue.length,1);eq(queue[0].accountId,original.id);eq(queue[0].mobile,'+919876543210');eq(queue[0].email,signup.email);
  for(let i=0;i<2;i++)eq((await call('/api/portal/recover',{identifier:signup.username,turnstile:'recover'})).status,202);
  eq((await call('/api/portal/recover',{identifier:signup.mobile,turnstile:'recover'})).status,429);
  eq((await db.prepare('SELECT count(*) AS n FROM portal_recovery_requests').first()).n,1);
  const reset={accountId:original.id,reason:'Stored contact checked independently'};
  eq((await call('/api/portal/admin/accounts',reset,admin)).status,400);
  eq((await db.prepare('SELECT status FROM portal_accounts WHERE id=?').bind(original.id).first()).status,'active');
  const issued=await call('/api/portal/admin/accounts',{...reset,identityConfirmed:true},admin);eq(issued.status,200);
  eq(issued.data.expiresAt>Date.now()+1790000&&issued.data.expiresAt<=Date.now()+1800000,true);
  const token=new URL(issued.data.activationUrl).hash.slice(1),stored=await db.prepare('SELECT token_hash FROM portal_activations WHERE account_id=?').bind(original.id).first();
  eq(stored.token_hash,createHash('sha256').update(token).digest('hex'));
  eq((await call('/api/portal/admin/accounts',null,admin)).data.recoveryRequests.length,0);
  eq((await call('/api/portal/me',null,member.cookie)).data.user,null);
  const newPassword='New recovered member password 2026!';
  const activation=await call('/api/portal/activate',{token,password:newPassword,turnstile:'activate'});eq(activation.status,200);
  eq((await call('/api/portal/activate',{token,password:newPassword,turnstile:'activate'})).status,400);
  eq((await call('/api/portal/login',{mobile:signup.mobile,password:signup.password,turnstile:'login'})).status,401);
  eq((await call('/api/portal/login',{mobile:signup.mobile,password:newPassword,turnstile:'login'})).status,200);
  eq((await db.prepare('SELECT reviewed_by FROM portal_recovery_requests WHERE account_id=?').bind(original.id).first()).reviewed_by,adminId);
  console.log(`PASS: ${checks} recovery checks: generic public replies, Turnstile/origin, three attempts, private MFA queue, identity confirmation, 30-minute hashed tokens, old-session revocation and single-use password reset.`);
}finally{await runtime.dispose();}
