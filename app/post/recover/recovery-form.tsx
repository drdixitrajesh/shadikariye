'use client';
import {useState,type FormEvent} from 'react';
import {portalApi,useTurnstile} from '../../portal/client';
export default function RecoveryForm({siteKey}:{siteKey:string}){
  const challenge=useTurnstile(siteKey,'recover'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);setBusy(true);setError('');try{const result=await portalApi<{message:string}>('/api/submissions/recover',{mobile:form.get('mobile'),profileId:form.get('profileId'),turnstile:await challenge.execute()});setMessage(result.message);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <>{message?<p role="status" className="posting-help">{message}</p>:<form className="simple-post-form" onSubmit={submit}><fieldset disabled={busy}><label>पोस्ट का संपर्क मोबाइल<input name="mobile" type="tel" required autoComplete="tel" maxLength={30}/></label><label>पोस्ट ID (वैकल्पिक)<input name="profileId" maxLength={36}/><small>पोस्ट जमा होने पर मिली ID उपलब्ध हो तो लिखें।</small></label></fieldset><div ref={challenge.container}/>{(error||challenge.error)&&<p role="alert">{error||challenge.error}</p>}<button className="primary" disabled={busy||!challenge.ready}>{busy?'अनुरोध भेज रहे हैं…':'लिंक वापस पाने का अनुरोध भेजें'}</button></form>}<p>सहायता: <a href="tel:+919131591131">Admin 9131591131</a></p><p>प्रोफ़ाइल पहले ही खाते से जुड़ी है? <a href="/login">Login करें</a> या <a href="/forgot-password">पासवर्ड सहायता लें</a>।</p></>;
}
