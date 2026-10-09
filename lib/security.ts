import {env} from 'cloudflare:workers';
import {db,json} from './store';
import {isPortal} from './portal-auth';
import {portalUser} from './portal-context';
export function testAccess(owner:string){const user=portalUser();return isPortal()&&user?.id===owner&&user.role==='member'&&user.testAccount;}
export function indianDay(now=Date.now()){return new Date(now+19800000).toISOString().slice(0,10);}
export function ageFromDate(date:string){const today=indianDay();let age=Number(today.slice(0,4))-Number(date.slice(0,4));if(today.slice(5)<date.slice(5))age--;return age;}
export function validBirthDate(date:string){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date&&ageFromDate(date)>=21&&ageFromDate(date)<=70;}
export function otpReady(){return Boolean(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_VERIFY_SERVICE_SID&&env.OTP_HASH_SECRET&&env.OTP_HASH_SECRET.length>=32);}
export async function verified(owner:string){return Boolean(await db().prepare('SELECT owner FROM otp_accounts WHERE owner=? AND verified_at>0').bind(owner).first());}
export async function requireVerified(owner:string){if(testAccess(owner))return null;return await verified(owner)?null:json({error:'मोबाइल OTP सत्यापन आवश्यक है। SMS सेवा सक्रिय होने पर सत्यापन करें। / Mobile OTP verification is required. Verify once the SMS service is enabled.'},403);}
export async function blocked(owner:string,target:string){return Boolean(await db().prepare('SELECT 1 FROM blocks WHERE (owner=? AND target=?) OR (target IN (SELECT id FROM profiles WHERE owner=?) AND owner IN (SELECT owner FROM profiles WHERE id=?))').bind(owner,target,owner,target).first());}
export async function reserveView(owner:string,target:string){
  const day=indianDay();
  await db().prepare('INSERT OR IGNORE INTO daily_views (owner,day,target) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM daily_views WHERE owner=? AND day=?)<20').bind(owner,day,target,owner,day).run();
  return Boolean(await db().prepare('SELECT target FROM daily_views WHERE owner=? AND day=? AND target=?').bind(owner,day,target).first());
}
export async function hasView(owner:string,target:string){return Boolean(await db().prepare('SELECT target FROM daily_views WHERE owner=? AND day=? AND target=?').bind(owner,indianDay(),target).first());}
export async function phoneHash(phone:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.OTP_HASH_SECRET!),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(phone))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function twilio(path:string,values:Record<string,string>){
  const response=await fetch('https://verify.twilio.com/v2/Services/'+env.TWILIO_VERIFY_SERVICE_SID+'/'+path,{method:'POST',headers:{Authorization:'Basic '+btoa(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values),signal:AbortSignal.timeout(15000)});
  const data=await response.json() as {status?:string};return {ok:response.ok,status:data.status};
}
