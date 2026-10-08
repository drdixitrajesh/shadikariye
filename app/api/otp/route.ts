import {db,identity,json,errorResponse,validOrigin} from '@/lib/store';
import {indianDay,otpReady,phoneHash,twilio} from '@/lib/security';
export async function POST(request:Request){
  const owner=await identity();if(!owner)return json({error:'Sign in required'},401);
  if(!validOrigin(request))return json({error:'Invalid request origin'},403);
  if(!otpReady())return json({error:'SMS सेवा अभी सक्रिय नहीं है। OTP सत्यापन उपलब्ध होने पर ही नई प्रोफ़ाइल प्रकाशित होगी। / SMS verification is not configured yet.'},503);
  try{
    const body=await request.json() as {action:string;phone:string;code?:string};
    const phone=typeof body.phone==='string'?body.phone.replace(/[\s-]/g,''):'';
    if(!/^\+91[6-9]\d{9}$/.test(phone)||!['send','verify'].includes(body.action))return json({error:'भारत का मोबाइल नंबर +91 के साथ दें। / Enter an Indian mobile number with +91.'},400);
    const hash=await phoneHash(phone),now=Date.now();
    await db().prepare('DELETE FROM otp_accounts WHERE verified_at=0 AND expires_at<=?').bind(now).run();
    const row=await db().prepare('SELECT * FROM otp_accounts WHERE owner=?').bind(owner).first<{phone_hash:string;verified_at:number;expires_at:number;attempts:number;sent_at:number}>();
    if(row?.verified_at)return json({ok:true,verified:true});
    if(body.action==='send'){
      if(row&&now-row.sent_at<60000)return json({error:'60 सेकंड बाद फिर प्रयास करें। / Wait 60 seconds.'},429);
      const duplicate=await db().prepare('SELECT owner FROM otp_accounts WHERE phone_hash=? AND owner<>?').bind(hash,owner).first();
      if(duplicate)return json({error:'यह नंबर उपयोग नहीं किया जा सकता। / This number cannot be used.'},409);
      const rate=await db().prepare('INSERT INTO otp_sends (owner,day,count) VALUES (?,?,1) ON CONFLICT(owner,day) DO UPDATE SET count=count+1 WHERE count<5 RETURNING count').bind(owner,indianDay()).first();
      if(!rate)return json({error:'आज OTP भेजने की सीमा पूरी हुई। / Daily OTP limit reached.'},429);
      const reservation=await db().prepare('INSERT INTO otp_accounts (owner,phone_hash,phone_last4,verified_at,expires_at,attempts,sent_at) VALUES (?,?,?,0,?,0,?) ON CONFLICT(owner) DO UPDATE SET phone_hash=excluded.phone_hash,phone_last4=excluded.phone_last4,expires_at=excluded.expires_at,attempts=0,sent_at=excluded.sent_at WHERE verified_at=0 AND sent_at<? RETURNING owner').bind(owner,hash,phone.slice(-4),now+600000,now,now-60000).first();
      if(!reservation)return json({error:'Wait 60 seconds'},429);
      const result=await twilio('Verifications',{To:phone,Channel:'sms'});
      if(!result.ok){await db().prepare('UPDATE otp_accounts SET expires_at=? WHERE owner=? AND phone_hash=? AND verified_at=0 AND sent_at=?').bind(Date.now(),owner,hash,now).run();return json({error:'OTP भेजा नहीं जा सका। बाद में प्रयास करें। / SMS could not be sent.'},503);}
      return json({ok:true,expiresIn:600});
    }
    if(!/^\d{6}$/.test(body.code??'')||!row||row.phone_hash!==hash||row.expires_at<now)return json({error:'OTP समाप्त या अमान्य है। / OTP expired or invalid.'},400);
    const attempt=await db().prepare('UPDATE otp_accounts SET attempts=attempts+1 WHERE owner=? AND phone_hash=? AND expires_at>? AND attempts<5 AND verified_at=0 RETURNING owner').bind(owner,hash,now).first();
    if(!attempt)return json({error:'प्रयास की सीमा पूरी हुई। नया OTP लें। / Attempt limit reached. Request a new OTP.'},429);
    const result=await twilio('VerificationCheck',{To:phone,Code:body.code!});
    if(!result.ok||result.status!=='approved')return json({error:'OTP सही नहीं है। / Incorrect OTP.'},400);
    const success=await db().prepare('UPDATE otp_accounts SET verified_at=? WHERE owner=? AND phone_hash=? AND expires_at>? AND verified_at=0 RETURNING owner').bind(now,owner,hash,now).first();
    if(!success)return json({error:'OTP expired or changed. Retry.'},409);
    return json({ok:true,verified:true});
  }catch(e){return errorResponse(e);}
}
