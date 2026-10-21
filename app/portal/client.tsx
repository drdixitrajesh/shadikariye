'use client';
import {useEffect,useRef,useState,type ReactNode,type FormEvent} from 'react';
import Link from 'next/link';
import {consumeActivationToken,passwordError} from './helpers';
export type PortalUser={username:string;role:string;mfa:boolean;testAccount:boolean};
export type PortalMe={user:PortalUser|null;siteKey:string;mfaRequired:boolean;publicRegistration?:boolean};
export async function portalApi<T>(path:string,body?:unknown):Promise<T>{
  const response=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const data=await response.json() as Record<string,unknown>;
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'फिर प्रयास करें। / Please try again.');
  return data as T;
}
export function PortalFrame({title,children}:{title:string;children:ReactNode}){
  return <main className="legal-page portal-page"><Link href="/">वैदिक मिलन / Vedik Milan</Link><h1>{title}</h1><p className="legal-free">पूर्णतः निःशुल्क / Completely free</p><p>अपनी प्रोफ़ाइल निःशुल्क प्रकाशित करें। / Publish your profile for free.</p><section className="security-panel">{children}</section><p><a href="/terms">नियम और डिस्क्लेमर / Terms & disclaimer</a></p></main>;
}
export function LogoutButton({label='लॉग आउट / Log out'}:{label?:string}){const [busy,setBusy]=useState(false),[error,setError]=useState('');return <><button type="button" className="text-button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await portalApi('/api/portal/logout',{});window.location.assign('/');}catch(e){setError((e as Error).message);setBusy(false);}}}>{label}</button>{error&&<span role="alert" className="form-error">{error}</span>}</>;}
type TurnstileAPI={render:(container:HTMLElement,options:Record<string,unknown>)=>string;execute:(id:string)=>void;reset:(id:string)=>void;remove:(id:string)=>void};
declare global{interface Window{turnstile?:TurnstileAPI;}}
export function useTurnstile(siteKey:string,action:'login'|'activate'|'register'|'recover'){
  const container=useRef<HTMLDivElement>(null),widget=useRef<string|null>(null),resolver=useRef<{resolve:(token:string)=>void;reject:(error:Error)=>void}|null>(null);
  const [ready,setReady]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(!siteKey)return;
    let disposed=false;
    const fail=()=>{const message='सुरक्षा जांच पूरी नहीं हुई। फिर प्रयास करें। / Security check failed. Please retry.';setError(message);resolver.current?.reject(new Error(message));resolver.current=null;};
    const render=()=>{if(disposed||!container.current||!window.turnstile||widget.current!==null)return;widget.current=window.turnstile.render(container.current,{sitekey:siteKey,action,execution:'execute',appearance:'interaction-only',size:'flexible',callback:(token:string)=>{resolver.current?.resolve(token);resolver.current=null;},'error-callback':()=>{fail();return true;},'expired-callback':fail,'timeout-callback':fail});setReady(true);};
    const existing=document.querySelector<HTMLScriptElement>('script[data-milan-turnstile]');
    const script=existing??document.createElement('script');
    script.addEventListener('load',render);script.addEventListener('error',fail);
    if(!existing){script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.dataset.milanTurnstile='true';document.head.appendChild(script);}render();
    return ()=>{disposed=true;script.removeEventListener('load',render);script.removeEventListener('error',fail);if(widget.current!==null){window.turnstile?.remove(widget.current);widget.current=null;}resolver.current?.reject(new Error('Security check cancelled'));resolver.current=null;};
  },[siteKey,action]);
  async function execute(){setError('');if(!ready||!window.turnstile||widget.current===null)throw new Error('सुरक्षा जांच तैयार नहीं है। पृष्ठ फिर खोलें। / Security check is not ready. Reload the page.');const id=widget.current;return new Promise<string>((resolve,reject)=>{resolver.current={resolve,reject};window.turnstile!.reset(id);window.turnstile!.execute(id);});}
  return {container,ready,error,execute};
}
export function CredentialsForm({activation=false,registration=false}:{activation?:boolean;registration?:boolean}){
  const [me,setMe]=useState<PortalMe|null>(null),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[hasToken,setHasToken]=useState(false);
  const [termsAccepted,setTermsAccepted]=useState(false);
  const [mobile,setMobile]=useState(''),[email,setEmail]=useState('');
  const token=useRef(''),consumed=useRef(false);
  const {container:challengeContainer,ready:challengeReady,error:challengeError,execute:executeChallenge}=useTurnstile(me?.siteKey??'',activation?'activate':registration?'register':'login');
  useEffect(()=>{
    if(activation&&!consumed.current){consumed.current=true;token.current=consumeActivationToken(window.location,window.history);setHasToken(Boolean(token.current));}
    void portalApi<PortalMe>('/api/portal/me').then(setMe).catch(e=>setError((e as Error).message));
  },[activation]);
  async function submit(event:FormEvent){event.preventDefault();const values=new FormData(event.currentTarget as HTMLFormElement);const submittedPassword=String(values.get('password')??'');const submittedConfirmation=String(values.get('confirmation')??'');setError('');if(activation||registration){const problem=passwordError(submittedPassword,submittedConfirmation);if(problem){setError(problem);return;}if(activation&&!token.current){setError('यह आमंत्रण अमान्य है। / This invitation is invalid.');return;}}
    setBusy(true);try{const turnstile=await executeChallenge();const result=await portalApi<{mfaRequired?:boolean}>(activation?'/api/portal/activate':registration?'/api/portal/register':'/api/portal/login',activation?{token:token.current,password:submittedPassword,turnstile}:{password:submittedPassword,turnstile,...(registration?{username:String(values.get('username')??''),mobile:String(values.get('mobile')??''),email:String(values.get('email')??''),termsAccepted:values.has('termsAccepted')}:{identifier:String(values.get('identifier')??'')})});token.current='';setPassword('');setConfirmation('');window.location.assign(result.mfaRequired?'/account':'/?createProfile=1');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <form onSubmit={submit}>
    {!activation&&<p>सार्वजनिक प्रोफ़ाइल बिना लॉग इन देखें। पोस्ट बनाने, पसंद सहेजने और बातचीत के लिए मोबाइल नंबर वाले खाते से लॉग इन करें। / Browse public profiles without signing in. Sign in with an account that has a mobile number to post, shortlist or connect.</p>}
    {activation?<p>आमंत्रण एक बार उपयोग होता है। अपना नया पासवर्ड चुनें। / This invitation is single-use. Choose your own password.</p>:registration?<p>मोबाइल नंबर, यूज़रनेम और पासवर्ड से खाता बनाएं। Email ID वैकल्पिक है। / Create an account with your mobile, username and password. Email is optional.</p>:<p>मोबाइल नंबर या यूज़रनेम और पासवर्ड से लॉग इन करें। / Sign in with your mobile number or username and password.</p>}
    {!activation&&<div className="field"><label htmlFor="portal-mobile">{registration?'मोबाइल नंबर / Mobile number':'मोबाइल नंबर या यूज़रनेम / Mobile number or username'}</label><input id="portal-mobile" name={registration?'mobile':'identifier'} type={registration?'tel':'text'} inputMode={registration?'tel':'text'} autoComplete={registration?'section-registration tel':'username'} autoCapitalize="none" spellCheck={false} required maxLength={registration?30:40} placeholder={registration?'+91 98765 43210':undefined} aria-describedby="portal-mobile-help" value={mobile} onChange={e=>setMobile(e.target.value)} disabled={busy}/><p id="portal-mobile-help">{registration?'भारत का 10 अंकों वाला नंबर, +91 के साथ या बिना। / Indian mobile, with or without +91.':'पंजीकृत मोबाइल नंबर या अपना पुराना यूज़रनेम लिखें। / Enter your registered mobile or existing username.'}</p></div>}
    {registration&&<div className="field"><label htmlFor="portal-username">यूज़रनेम / Username</label><input id="portal-username" name="username" required autoComplete="username" maxLength={40} minLength={3} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,39}" value={username} onChange={e=>setUsername(e.target.value)} disabled={busy}/></div>}
    {registration&&<><div className="field"><label htmlFor="portal-email">Email ID (वैकल्पिक / Optional)</label><input id="portal-email" type="email" name="email" autoComplete="section-registration email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></div><p>आपके संपर्क विवरण सार्वजनिक नहीं दिखाए जाएंगे। मोबाइल और ईमेल का सत्यापन अभी नहीं हुआ है। / Your contact details are not displayed publicly. Phone and email are not verified.</p></>}
    <div className="field"><label htmlFor="portal-password">{activation||registration?'नया पासवर्ड (16–128 अक्षर) / New password (16–128 characters)':'पासवर्ड / Password'}</label><input id="portal-password" name="password" type="password" required minLength={activation||registration?16:undefined} maxLength={128} autoComplete={activation||registration?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></div>
    {(activation||registration)&&<div className="field"><label htmlFor="portal-confirm">पासवर्ड फिर लिखें / Confirm password</label><input id="portal-confirm" name="confirmation" type="password" required minLength={16} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy}/></div>}
    {registration&&<><p>यूज़रनेम: 3–40 English letters, numbers, dot, underscore or hyphen. अपना पासवर्ड सुरक्षित रखें। / Keep your password safe.</p><label className="consent-box"><input type="checkbox" required name="termsAccepted" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} disabled={busy}/> मैं <a href="/terms" target="_blank" rel="noopener">नियम और डिस्क्लेमर / Terms & disclaimer</a> स्वीकार करता/करती हूँ।</label>{me&&!me.publicRegistration&&<p role="alert">नया खाता बनाना अभी उपलब्ध नहीं है। / Registration is currently unavailable.</p>}</>}
    {activation&&!hasToken&&<p role="status">पूरा आमंत्रण लिंक खोलें। लिंक का # भाग आवश्यक है। / Open the complete invitation link, including its # fragment.</p>}
    {!activation&&!registration&&<><p><a href="/forgot-password">पासवर्ड भूल गए? / Forgot password?</a></p><p>3 गलत प्रयासों के बाद लॉगिन 15 मिनट के लिए रुक जाएगा। / Three failed attempts lock sign-in for 15 minutes.</p></>}
    <div ref={challengeContainer} aria-label="Cloudflare security check"/>
    {(error||challengeError)&&<p role="alert" className="form-error">{error||challengeError}</p>}
    {me&&!me.siteKey&&<p role="status">लॉग इन अभी उपलब्ध नहीं है। / Sign-in is not available yet.</p>}
    {!activation&&<p>{registration?<a href="/login">पहले से खाता है? लॉग इन करें / Already have an account? Sign in</a>:me?.publicRegistration&&<a href="/register">नया खाता बनाएं और प्रोफ़ाइल पोस्ट करें / Create an account and post your profile</a>}</p>}
    <button className="primary" disabled={busy||!challengeReady||(activation&&!hasToken)||(registration&&(!termsAccepted||!me?.publicRegistration))}>{busy?'जांच हो रही है… / Checking…':activation?'खाता सक्रिय करें / Activate account':registration?'खाता बनाएं और प्रोफ़ाइल भरें / Create account & continue':'लॉग इन / Sign in'}</button>
  </form>;
}
