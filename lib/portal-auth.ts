import {env} from 'cloudflare:workers';
import {type PortalUser,portalUser} from './portal-context';
import {accountContact,normalizeMobile} from './account-contact';
import {reserveCredentialAttempt,clearCredentialAttempts} from './credential-attempts';
const encoder=new TextEncoder();
export const SESSION_COOKIE='__Host-managelove';
export function isPortal(){return env.STANDALONE_MODE==='test-portal';}
export function publicRegistration(){return isPortal()&&env.PUBLIC_REGISTRATION==='1';}
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
export function portalJson(data:unknown,status=200,cookie?:string){const headers=new Headers({'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'});if(cookie)headers.set('Set-Cookie',cookie);return new Response(JSON.stringify(data),{status,headers});}
export function sessionCookie(token:string,maxAge:number){return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;}
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin&&new URL(request.url).protocol==='https:'&&!['cross-site','same-site'].includes(request.headers.get('sec-fetch-site')??'');}
export async function readBody(request:Request):Promise<Record<string,unknown>>{
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('invalid-input');
  const reader=request.body?.getReader();if(!reader)throw new Error('invalid-input');
  const chunks:Uint8Array[]=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>8192){await reader.cancel();throw new Error('invalid-input');}chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const parsed=JSON.parse(new TextDecoder().decode(bytes));if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error('invalid-input');return parsed;
}
export async function resolveSession(request:Request):Promise<PortalUser|null>{
  const pairs=(request.headers.get('cookie')??'').split(';').map(x=>x.trim().split('='));
  const tokens=pairs.filter(x=>x[0]===SESSION_COOKIE);if(tokens.length!==1||!/^[a-f0-9]{64}$/.test(tokens[0][1]??'')||!env.DB)return null;
  const hash=await digest(tokens[0][1]);
  const row=await env.DB.prepare('SELECT a.id,a.username,a.role,a.test_account,a.mfa_enrolled,s.mfa_verified,s.session_version FROM portal_sessions s JOIN portal_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND s.session_version=a.session_version AND a.status=\'active\'').bind(hash,Date.now()).first<{id:string;username:string;role:'admin'|'member';test_account:number;mfa_enrolled:number;mfa_verified:number;session_version:number}>();
  return row?{id:row.id,username:row.username,role:row.role,testAccount:Boolean(row.test_account),mfa:Boolean(row.mfa_verified),mfaEnrolled:Boolean(row.mfa_enrolled),sessionHash:hash,sessionVersion:row.session_version}:null;
}
export async function makeSession(account:{id:string;role:string;session_version:number},mfa=false){
  const token=randomToken(),hash=await digest(token),duration=account.role==='admin'?(mfa?7200:600):43200;
  const now=Date.now();
  const inserted=await env.DB!.prepare('INSERT INTO portal_sessions (token_hash,account_id,session_version,mfa_verified,created_at,expires_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM portal_accounts WHERE id=? AND status=\'active\' AND session_version=?)').bind(hash,account.id,account.session_version,mfa?1:0,now,now+duration*1000,account.id,account.session_version).run();
  if(!inserted.meta.changes)throw new Error('account-access-revoked');
  return sessionCookie(token,duration);
}
export async function throttle(request:Request,scope:string,subject='',limits={ip:40,subject:12,global:160}){
  const now=Date.now(),window=Math.floor(now/900000);
  const ip=request.headers.get('CF-Connecting-IP')??'unknown-edge';
  const keys=[{key:await digest(scope+':ip:'+ip),limit:limits.ip},{key:await digest(scope+':subject:'+subject),limit:limits.subject},{key:await digest(scope+':global'),limit:limits.global}];
  const rows=await env.DB!.batch(keys.map(k=>env.DB!.prepare('INSERT INTO portal_throttle (key,window,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count').bind(k.key,window)));
  return rows.every((row,i)=>Number((row.results?.[0] as {count?:number})?.count??999)<=keys[i].limit);
}
export async function turnstile(token:unknown,action:'login'|'activate'|'register'|'recover',hostname='managelove.com'){
  if(typeof token!=='string'||token.length<1||token.length>2048||!env.TURNSTILE_SECRET_KEY)return false;
  try{
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token}),signal:AbortSignal.timeout(10000)});
    const result=await response.json() as {success?:boolean;hostname?:string;action?:string;challenge_ts?:string};
    const age=Date.now()-Date.parse(result.challenge_ts??'');
    return response.ok&&result.success===true&&['vedik-milan.softinator.org','managelove.com','www.managelove.com'].includes(hostname)&&result.hostname===hostname&&result.action===action&&age>=-30000&&age<300000;
  }catch{return false;}
}
export async function passwordService(accountId:string,password:string,hash?:string){
  if(!env.PASSWORD_SERVICE)throw new Error('password-service-unavailable');
  const stub=env.PASSWORD_SERVICE.get(env.PASSWORD_SERVICE.idFromName(accountId));
  const response=await stub.fetch('https://password.internal/',{method:'POST',body:JSON.stringify({password,hash,operation:hash===undefined?'hash':'verify'})});
  if(!response.ok)throw new Error('password-service-unavailable');return await response.json() as {hash:string;ok:boolean};
}
export function validPassword(value:unknown):value is string{return typeof value==='string'&&value.normalize('NFKC').length>=16&&value.normalize('NFKC').length<=128&&!/^\s+$/.test(value);}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newMfaSecret(){const bytes=crypto.getRandomValues(new Uint8Array(20));let bits=0,value=0,out='';for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}return out;}
function decodeBase32(secret:string){let bits=0,value=0;const out=[];for(const c of secret){const i=alphabet.indexOf(c);if(i<0)throw new Error('bad-mfa-secret');value=(value<<5)|i;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return new Uint8Array(out);}
async function encryptionKey(){if(!/^[a-f0-9]{64}$/.test(env.PORTAL_KEY??''))throw new Error('mfa-service-unavailable');const bytes=Uint8Array.from((env.PORTAL_KEY!.match(/../g)??[]).map(x=>parseInt(x,16)));return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);}
export async function encryptMfa(secret:string){const iv=crypto.getRandomValues(new Uint8Array(12));const result=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('managelove-mfa-v1')},await encryptionKey(),encoder.encode(secret)));return Array.from(iv,b=>b.toString(16).padStart(2,'0')).join('')+'.'+Array.from(result,b=>b.toString(16).padStart(2,'0')).join('');}
export async function decryptMfa(value:string){const [iv,cipher]=value.split('.');const bytes=(s:string)=>Uint8Array.from(s.match(/../g)!.map(x=>parseInt(x,16)));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv),additionalData:encoder.encode('managelove-mfa-v1')},await encryptionKey(),bytes(cipher)));}
export async function mfaCounter(secret:string,code:string){
  if(!/^\d{6}$/.test(code))return null;
  const key=await crypto.subtle.importKey('raw',decodeBase32(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
  const current=Math.floor(Date.now()/30000);
  for(const counter of [current,current-1,current+1]){const data=new Uint8Array(8);new DataView(data.buffer).setBigUint64(0,BigInt(counter));const signed=new Uint8Array(await crypto.subtle.sign('HMAC',key,data));const start=signed[19]&15;const n=((signed[start]&127)<<24)|(signed[start+1]<<16)|(signed[start+2]<<8)|signed[start+3];if(String(n%1000000).padStart(6,'0')===code)return counter;}
  return null;
}
export async function handlePortal(request:Request){
  const path=new URL(request.url).pathname,user=portalUser();
  if(!path.startsWith('/api/portal/'))return null;
  if(!isPortal())return portalJson({error:'Standalone portal unavailable'},404);
  try{
    if(path==='/api/portal/me'&&request.method==='GET')return portalJson({user:user?{id:user.id,username:user.username,role:user.role,testAccount:user.testAccount,mfa:user.mfa}:null,siteKey:env.TURNSTILE_SITE_KEY,mfaRequired:user?.role==='admin'&&!user.mfa,publicRegistration:publicRegistration()});
    if(!['GET','POST'].includes(request.method))return portalJson({error:'Method not allowed'},405);
    if(request.method==='POST'&&!sameOrigin(request))return portalJson({error:'Invalid request origin'},403);
    if(path==='/api/portal/recover'&&request.method==='POST'){
      const body=await readBody(request),identifier=typeof body.identifier==='string'?body.identifier.trim().toLowerCase():'';
      const mobile=normalizeMobile(identifier);
      if(!mobile&&!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(identifier))return portalJson({error:'पंजीकृत मोबाइल नंबर या यूज़रनेम दें। / Enter your registered mobile or username.'},400);
      if(!await throttle(request,'recover',mobile||identifier,{ip:6,subject:3,global:80}))return portalJson({error:'3 प्रयासों के बाद 15 मिनट प्रतीक्षा करें। / Wait 15 minutes after three attempts.'},429);
      if(!await turnstile(body.turnstile,'recover',new URL(request.url).hostname))return portalJson({error:'सुरक्षा जांच पूरी करें और फिर प्रयास करें। / Complete the security check and retry.'},403);
      const account=await env.DB!.prepare('SELECT id,role,status FROM portal_accounts WHERE '+(mobile?'mobile=?':'username=?')).bind(mobile||identifier).first<{id:string;role:string;status:string}>();
      const key=await digest('recover:'+(account?.id??(mobile||identifier)));
      if(!await reserveCredentialAttempt(env.DB!,key))return portalJson({error:'3 प्रयासों के बाद 15 मिनट प्रतीक्षा करें। / Wait 15 minutes after three attempts.'},429);
      if(account?.role==='member'&&account.status!=='disabled')await env.DB!.prepare('INSERT INTO portal_recovery_requests(account_id,requested_at) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET requested_at=excluded.requested_at,resolved_at=NULL,reviewed_by=NULL').bind(account.id,Date.now()).run();
      return portalJson({ok:true,message:'यदि यह जानकारी किसी पात्र खाते से मेल खाती है, तो सहायता अनुरोध दर्ज हो गया है। पहचान की पुष्टि के बाद निजी रीसेट लिंक दिया जाएगा। SMS या Email अपने आप नहीं भेजा जाता। / If the details match an eligible account, a recovery request has been recorded. A private reset link follows identity verification; no automatic SMS or email is sent.'},202);
    }
    if(path==='/api/portal/register'&&request.method==='POST'){
      if(!publicRegistration())return portalJson({error:'Registration unavailable'},404);
      const body=await readBody(request);
      const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
      let contact;try{contact=accountContact(body);}catch(error){return portalJson({error:(error as Error).message},400);}
      if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))return portalJson({error:'3–40 अक्षरों का यूज़रनेम चुनें: English letters, numbers, dot, underscore or hyphen.'},400);
      if(body.termsAccepted!==true||!validPassword(body.password))return portalJson({error:'नियम स्वीकार करें और 16–128 अक्षरों का पासवर्ड चुनें। / Accept the terms and use a password of 16–128 characters.'},400);
      if(!await throttle(request,'register',username,{ip:5,subject:3,global:80}))return portalJson({error:'Too many attempts. Please wait 15 minutes. / 15 मिनट बाद प्रयास करें।'},429);
      if(!await turnstile(body.turnstile,'register',new URL(request.url).hostname))return portalJson({error:'Security check failed. Please retry Turnstile.'},403);
      const id=crypto.randomUUID();
      const {hash}=await passwordService(id,body.password.normalize('NFKC'));
      const created=await env.DB!.prepare("INSERT INTO portal_accounts (id,username,role,password_hash,status,session_version,test_account,created_at,mobile,contact_email) VALUES (?,?,'member',?,'active',0,0,?,?,?) ON CONFLICT DO NOTHING").bind(id,username,hash,Date.now(),contact.mobile,contact.email).run();
      if(!created.meta.changes)return portalJson({error:'यह यूज़रनेम या मोबाइल पहले से जुड़ा है। लॉग इन करें या अलग जानकारी दें। / Username or mobile already registered.'},409);
      return portalJson({ok:true},201,await makeSession({id,role:'member',session_version:0}));
    }
    if(path==='/api/portal/logout'&&request.method==='POST'){if(user)await env.DB!.prepare('DELETE FROM portal_sessions WHERE token_hash=?').bind(user.sessionHash).run();return portalJson({ok:true},200,sessionCookie('',0));}
    if((path==='/api/portal/login'||path==='/api/portal/activate')&&request.method==='POST'){
      const body=await readBody(request),action=path.endsWith('login')?'login':'activate';
      const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
      const mobile=normalizeMobile(body.mobile);
      const token=typeof body.token==='string'?body.token:'';
      if(!await throttle(request,action,action==='login'?(mobile||(/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)?username:'unknown')):await digest(token)))return portalJson({error:'Too many attempts. Please wait 15 minutes. / 15 मिनट बाद प्रयास करें।'},429);
      if(!await turnstile(body.turnstile,action,new URL(request.url).hostname))return portalJson({error:'Security check failed. Please retry Turnstile.'},403);
      if(action==='login'){
        const account=await env.DB!.prepare('SELECT id,role,password_hash,status,session_version FROM portal_accounts WHERE '+(body.mobile!==undefined?'mobile=?':'username=?')).bind(body.mobile!==undefined?(mobile||'invalid-mobile'):username).first<{id:string;role:string;password_hash:string|null;status:string;session_version:number}>();
        const attemptKey=await digest('login:'+(account?.id??(body.mobile!==undefined?mobile:username)));
        if(!await reserveCredentialAttempt(env.DB!,attemptKey))return portalJson({error:'3 गलत प्रयास हो चुके हैं। 15 मिनट बाद प्रयास करें। / Three failed attempts. Try again after 15 minutes.'},429);
        if(!validPassword(body.password))return portalJson({error:'Use a password of 16–128 characters. / 16–128 अक्षरों का पासवर्ड चुनें।'},400);
        const check=await passwordService(account?.id??'unknown',body.password.normalize('NFKC'),account?.password_hash??'invalid');
        if(!account||account.status!=='active'||!check.ok)return portalJson({error:'मोबाइल / यूज़रनेम या पासवर्ड गलत है। / Invalid mobile, username or password.'},401);
        await clearCredentialAttempts(env.DB!,attemptKey);
        return portalJson({ok:true,mfaRequired:account.role==='admin'},200,await makeSession(account));
      }
      if(!validPassword(body.password))return portalJson({error:'Use a password of 16–128 characters. / 16–128 अक्षरों का पासवर्ड चुनें।'},400);
      const password=body.password.normalize('NFKC');
      if(!/^[a-f0-9]{64}$/.test(token))return portalJson({error:'Activation link is invalid or expired'},400);
      const tokenHash=await digest(token),now=Date.now();
      const activation=await env.DB!.prepare('SELECT a.id,a.role,a.session_version,t.id AS activation_id FROM portal_activations t JOIN portal_accounts a ON a.id=t.account_id WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>? AND a.status=\'invited\'').bind(tokenHash,now).first<{id:string;role:string;session_version:number;activation_id:string}>();
      if(!activation)return portalJson({error:'Activation link is invalid or expired'},400);
      const {hash}=await passwordService(activation.id,password);
      const claim=randomToken();
      const results=await env.DB!.batch([
        env.DB!.prepare('UPDATE portal_activations SET used_at=?,claim=? WHERE id=? AND used_at IS NULL AND expires_at>?').bind(now,claim,activation.activation_id,now),
        env.DB!.prepare('UPDATE portal_accounts SET password_hash=?,status=\'active\',session_version=session_version+1 WHERE id=? AND status=\'invited\' AND EXISTS(SELECT 1 FROM portal_activations WHERE id=? AND claim=?)').bind(hash,activation.id,activation.activation_id,claim),
        env.DB!.prepare('DELETE FROM portal_sessions WHERE account_id=? AND EXISTS(SELECT 1 FROM portal_activations WHERE id=? AND claim=?)').bind(activation.id,activation.activation_id,claim),
      ]);
      if(!results[1].meta.changes)return portalJson({error:'Activation link is invalid or expired'},400);
      return portalJson({ok:true,mfaRequired:activation.role==='admin'},200,await makeSession({...activation,session_version:activation.session_version+1}));
    }
    if(!user)return portalJson({error:'Sign in required'},401);
    if(path==='/api/portal/contact'){
      if(user.role==='admin'&&!user.mfa)return portalJson({error:'Administrator verification required'},403);
      if(request.method==='GET')return portalJson(await env.DB!.prepare("SELECT mobile,contact_email AS email FROM portal_accounts WHERE id=?").bind(user.id).first());
      const body=await readBody(request);
      let contact;try{contact=accountContact(body);}catch(error){return portalJson({error:(error as Error).message},400);}
      if(!await throttle(request,'contact',user.id))return portalJson({error:'बहुत अधिक प्रयास। 15 मिनट बाद प्रयास करें।'},429);
      const account=await env.DB!.prepare('SELECT password_hash FROM portal_accounts WHERE id=? AND status=\'active\'').bind(user.id).first<{password_hash:string}>();
      if(!validPassword(body.password)||!account||!(await passwordService(user.id,body.password.normalize('NFKC'),account.password_hash)).ok)return portalJson({error:'वर्तमान पासवर्ड सही नहीं है। / Incorrect current password.'},403);
      try{await env.DB!.prepare('UPDATE portal_accounts SET mobile=?,contact_email=? WHERE id=?').bind(contact.mobile,contact.email,user.id).run();}catch(error){if(String(error).includes('UNIQUE constraint failed: portal_accounts.mobile'))return portalJson({error:'यह मोबाइल दूसरे खाते से जुड़ा है। / Mobile already registered.'},409);throw error;}
      return portalJson({ok:true});
    }
    if(path==='/api/portal/mfa'){
      if(user.role!=='admin')return portalJson({error:'Administrator required'},403);
      const account=await env.DB!.prepare('SELECT mfa_secret,mfa_enrolled,mfa_counter FROM portal_accounts WHERE id=?').bind(user.id).first<{mfa_secret:string|null;mfa_enrolled:number;mfa_counter:number}>();
      if(!account)return portalJson({error:'Account unavailable'},401);
      if(request.method==='GET'){
        if(account.mfa_enrolled)return portalJson({enrolled:true});
        const candidate=await encryptMfa(newMfaSecret());
        await env.DB!.prepare('UPDATE portal_accounts SET mfa_secret=? WHERE id=? AND mfa_secret IS NULL AND mfa_enrolled=0').bind(candidate,user.id).run();
        const row=await env.DB!.prepare('SELECT mfa_secret,mfa_enrolled FROM portal_accounts WHERE id=?').bind(user.id).first<{mfa_secret:string;mfa_enrolled:number}>();
        if(!row||row.mfa_enrolled)return portalJson({enrolled:true});
        const secret=await decryptMfa(row.mfa_secret);
        return portalJson({enrolled:false,secret,uri:`otpauth://totp/Managelove:${encodeURIComponent(user.username)}?secret=${secret}&issuer=Managelove&algorithm=SHA1&digits=6&period=30`});
      }
      const body=await readBody(request);
      if(!await throttle(request,'mfa',user.id))return portalJson({error:'Too many attempts. Wait 15 minutes.'},429);
      if(!account.mfa_secret)return portalJson({error:'Enroll MFA first'},409);
      const attemptKey=await digest('mfa:'+user.id);
      if(!await reserveCredentialAttempt(env.DB!,attemptKey))return portalJson({error:'3 गलत कोड के बाद सत्यापन रुक गया है। 15 मिनट बाद प्रयास करें। / Three failed codes. Try again after 15 minutes.'},429);
      const counter=await mfaCounter(await decryptMfa(account.mfa_secret),String(body.code??''));
      if(counter===null||counter<=account.mfa_counter)return portalJson({error:'Invalid or already used authenticator code'},403);
      const claim=randomToken();
      const results=await env.DB!.batch([
        env.DB!.prepare('UPDATE portal_accounts SET mfa_enrolled=1,mfa_counter=?,mfa_claim=? WHERE id=? AND mfa_counter<? AND status=\'active\' AND session_version=? AND EXISTS(SELECT 1 FROM portal_sessions WHERE token_hash=? AND account_id=? AND session_version=? AND expires_at>?)').bind(counter,claim,user.id,counter,user.sessionVersion,user.sessionHash,user.id,user.sessionVersion,Date.now()),
        env.DB!.prepare('UPDATE portal_sessions SET mfa_verified=1,expires_at=? WHERE token_hash=? AND account_id=? AND session_version=? AND expires_at>? AND EXISTS(SELECT 1 FROM portal_accounts WHERE id=? AND mfa_claim=? AND status=\'active\' AND session_version=?)').bind(Date.now()+7200000,user.sessionHash,user.id,user.sessionVersion,Date.now(),user.id,claim,user.sessionVersion),
      ]);
      if(!results[1].meta.changes)return portalJson({error:'Authenticator code already used'},403);
      await clearCredentialAttempts(env.DB!,attemptKey);
      // Rotate the session after elevation to prevent fixation and revoke the
      // password-only token. The account counter prevents cross-session replay.
      const cookie=await makeSession({id:user.id,role:'admin',session_version:user.sessionVersion},true);
      await env.DB!.prepare('DELETE FROM portal_sessions WHERE token_hash=?').bind(user.sessionHash).run();
      return portalJson({ok:true},200,cookie);
    }
    if(path==='/api/portal/admin/accounts'){
      if(user.role!=='admin'||!user.mfa)return portalJson({error:'Administrator MFA required'},403);
      if(request.method==='GET'){
        const accounts=await env.DB!.prepare('SELECT id,username,role,status FROM portal_accounts ORDER BY role,username').all();
        const audit=await env.DB!.prepare('SELECT id,actor,target,action,reason,created_at FROM admin_actions ORDER BY created_at DESC LIMIT 100').all();
        const recovery=await env.DB!.prepare("SELECT a.id AS accountId,a.username,a.mobile,a.contact_email AS email,r.requested_at AS requestedAt FROM portal_recovery_requests r JOIN portal_accounts a ON a.id=r.account_id WHERE r.resolved_at IS NULL AND a.role='member' AND a.status<>'disabled' ORDER BY r.requested_at LIMIT 100").all();
        return portalJson({accounts:accounts.results,audit:audit.results,recoveryRequests:recovery.results});
      }
      const body=await readBody(request),accountId=String(body.accountId??''),reason=String(body.reason??'').trim();
      if(reason.length<10||reason.length>1000)return portalJson({error:'Provide a reason of 10–1000 characters'},400);
      const account=await env.DB!.prepare('SELECT id,role FROM portal_accounts WHERE id=?').bind(accountId).first<{id:string;role:string}>();
      if(!account||account.role==='admin')return portalJson({error:'Owner access cannot be reset here. Use the verified operational recovery process.'},403);
      const pending=await env.DB!.prepare('SELECT account_id FROM portal_recovery_requests WHERE account_id=? AND resolved_at IS NULL').bind(accountId).first();
      if(pending&&body.identityConfirmed!==true)return portalJson({error:'पंजीकृत संपर्क से स्वतंत्र रूप से पहचान की पुष्टि करें, फिर पुष्टि का विकल्प चुनें। / Verify identity through the stored contact before issuing a reset link.'},400);
      const token=randomToken(),id=crypto.randomUUID(),expires=Date.now()+(pending?1800000:172800000);
      await env.DB!.batch([
        env.DB!.prepare('UPDATE portal_accounts SET status=\'invited\',password_hash=NULL,session_version=session_version+1 WHERE id=? AND role=\'member\'').bind(accountId),
        env.DB!.prepare('DELETE FROM portal_sessions WHERE account_id=?').bind(accountId),
        env.DB!.prepare('DELETE FROM portal_activations WHERE account_id=?').bind(accountId),
        env.DB!.prepare('INSERT INTO portal_activations (id,account_id,token_hash,expires_at) VALUES (?,?,?,?)').bind(id,accountId,await digest(token),expires),
        env.DB!.prepare('DELETE FROM portal_credential_attempts WHERE key=?').bind(await digest('login:'+accountId)),
        env.DB!.prepare('UPDATE portal_recovery_requests SET resolved_at=?,reviewed_by=? WHERE account_id=? AND resolved_at IS NULL').bind(Date.now(),user.id,accountId),
        env.DB!.prepare("INSERT INTO admin_actions (id,actor,target,action,reason,created_at) VALUES (?,?,?,'reset_account',?,?)").bind(crypto.randomUUID(),user.id,accountId,reason,Date.now()),
      ]);
      return portalJson({ok:true,activationUrl:`https://vedik-milan.softinator.org/activate#${token}`,expiresAt:expires});
    }
    return portalJson({error:'Not found'},404);
  }catch(e){if(e instanceof Error&&e.message==='invalid-input'||e instanceof SyntaxError)return portalJson({error:'Invalid request'},400);console.error('Portal operation failed; no credential values recorded.');return portalJson({error:'Free service temporarily unavailable. Please retry later.'},503);}
}
