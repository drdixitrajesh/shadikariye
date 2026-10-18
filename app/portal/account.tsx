'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {LogoutButton,PortalFrame,portalApi,type PortalMe} from './client';
import AuthenticatorSetup from './authenticator-setup';
type Enrollment={secret?:string;uri?:string;enrolled:boolean};
export default function Account(){
  const [me,setMe]=useState<PortalMe|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[enrollment,setEnrollment]=useState<Enrollment|null>(null),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{void portalApi<PortalMe>('/api/portal/me').then(setMe).catch(e=>setError((e as Error).message)).finally(()=>setLoading(false));},[]);
  async function begin(){setBusy(true);setError('');try{setEnrollment(await portalApi<Enrollment>('/api/portal/mfa'));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function verify(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await portalApi('/api/portal/mfa',{code});setCode('');setEnrollment(null);setMe(await portalApi<PortalMe>('/api/portal/me'));setNotice('सुरक्षा जांच पूरी हुई। / Security check complete.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function copy(value:string){try{await navigator.clipboard.writeText(value);setNotice('कॉपी हो गया। इसे निजी रखें। / Copied. Keep this private.');}catch{setNotice('नीचे का टेक्स्ट चुनकर कॉपी करें। / Select and copy the text below.');}}
  return <PortalFrame title="मेरा खाता / My account">
    {loading?<p role="status">लोड हो रहा है… / Loading…</p>:!me?.user?<p>खाते में प्रवेश करें। / Sign in to your account. <a href="/login">लॉग इन / Sign in</a></p>:<>
      <h2>{me.user.username}</h2><p>{me.user.role==='admin'?'प्रशासक / Administrator':'सदस्य / Member'}</p>
      {me.user.testAccount&&<p className="admin-notice">काल्पनिक परीक्षण खाता। केवल काल्पनिक प्रोफ़ाइल और रेफरेंस उपयोग करें। मोबाइल या पहचान का सत्यापन नहीं हुआ है। / Fictional test account. Use fictional profile and reference details only. Phone and identity have not been verified.</p>}
      {me.user.role==='admin'&&(me.mfaRequired||!me.user.mfa)?<section>
        <h2>अनिवार्य प्रशासक सुरक्षा / Required administrator security</h2><p>प्रशासन खोलने से पहले अपने authenticator का छह अंक वाला कोड सत्यापित करें। / Verify a six-digit authenticator code before opening administration.</p>
        {!enrollment?<button className="secondary" disabled={busy} onClick={()=>void begin()}>Authenticator सेटअप या सत्यापन शुरू करें / Set up or verify authenticator</button>:<>
          {!enrollment.enrolled&&enrollment.secret&&enrollment.uri&&<AuthenticatorSetup secret={enrollment.secret} uri={enrollment.uri} onCopy={value=>void copy(value)}/>}
          <form onSubmit={verify}><div className="field"><label htmlFor="mfa-code">Authenticator कोड / Authenticator code</label><input id="mfa-code" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} disabled={busy}/></div><button className="primary" disabled={busy||code.length!==6}>कोड सत्यापित करें / Verify code</button></form>
        </>}
      </section>:<p><a className="primary" href={me.user.role==='admin'?'/admin':'/'}>{me.user.role==='admin'?'प्रशासन खोलें / Open administration':'प्रोफ़ाइल खोजें / Discover profiles'}</a></p>}
      <p><LogoutButton/></p>
    </>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="form-error">{error}</p>}
  </PortalFrame>;
}
