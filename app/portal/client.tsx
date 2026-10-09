'use client';
import {useEffect,useRef,useState,type ReactNode,type FormEvent} from 'react';
import Link from 'next/link';
import {consumeActivationToken,passwordError} from './helpers';
export type PortalUser={username:string;role:string;mfa:boolean;testAccount:boolean};
export type PortalMe={user:PortalUser|null;siteKey:string;mfaRequired:boolean};
export async function portalApi<T>(path:string,body?:unknown):Promise<T>{
  const response=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const data=await response.json() as Record<string,unknown>;
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'फिर प्रयास करें। / Please try again.');
  return data as T;
}
export function PortalFrame({title,children}:{title:string;children:ReactNode}){
  return <main className="legal-page"><Link href="/">वैदिक मिलन / Vaidik Milan</Link><h1>{title}</h1><p className="legal-free">पूर्णतः निःशुल्क / Completely free</p><p>केवल आमंत्रण से प्रवेश। / Invitation-only access.</p><section className="security-panel">{children}</section><p><a href="/terms">नियम और डिस्क्लेमर / Terms & disclaimer</a></p></main>;
}
export function LogoutButton({label='लॉग आउट / Log out'}:{label?:string}){const [busy,setBusy]=useState(false),[error,setError]=useState('');return <><button type="button" className="text-button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await portalApi('/api/portal/logout',{});window.location.assign('/');}catch(e){setError((e as Error).message);setBusy(false);}}}>{label}</button>{error&&<span role="alert" className="form-error">{error}</span>}</>;}
type TurnstileAPI={render:(container:HTMLElement,options:Record<string,unknown>)=>string;execute:(id:string)=>void;reset:(id:string)=>void;remove:(id:string)=>void};
declare global{interface Window{turnstile?:TurnstileAPI;}}
export function useTurnstile(siteKey:string,action:'login'|'activate'){
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
export function CredentialsForm({activation=false}:{activation?:boolean}){
  const [me,setMe]=useState<PortalMe|null>(null),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[hasToken,setHasToken]=useState(false);
  const token=useRef(''),consumed=useRef(false);
  const {container:challengeContainer,ready:challengeReady,error:challengeError,execute:executeChallenge}=useTurnstile(me?.siteKey??'',activation?'activate':'login');
  useEffect(()=>{
    if(activation&&!consumed.current){consumed.current=true;token.current=consumeActivationToken(window.location,window.history);setHasToken(Boolean(token.current));}
    void portalApi<PortalMe>('/api/portal/me').then(setMe).catch(e=>setError((e as Error).message));
  },[activation]);
  async function submit(event:FormEvent){event.preventDefault();setError('');if(activation){const problem=passwordError(password,confirmation);if(problem){setError(problem);return;}if(!token.current){setError('यह आमंत्रण अमान्य है। / This invitation is invalid.');return;}}
    setBusy(true);try{const turnstile=await executeChallenge();await portalApi(activation?'/api/portal/activate':'/api/portal/login',activation?{token:token.current,password,turnstile}:{username,password,turnstile});token.current='';setPassword('');setConfirmation('');window.location.assign('/account');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <form onSubmit={submit}>
    {activation?<p>आमंत्रण एक बार उपयोग होता है। अपना नया पासवर्ड चुनें। / This invitation is single-use. Choose your own password.</p>:<p>अपने आमंत्रित खाते से लॉग इन करें। कोई सार्वजनिक रजिस्ट्रेशन नहीं है। / Sign in with your invited account. There is no public registration.</p>}
    {!activation&&<div className="field"><label htmlFor="portal-username">यूज़रनेम / Username</label><input id="portal-username" required autoComplete="username" maxLength={80} value={username} onChange={e=>setUsername(e.target.value)} disabled={busy}/></div>}
    <div className="field"><label htmlFor="portal-password">{activation?'नया पासवर्ड (16–128 अक्षर) / New password (16–128 characters)':'पासवर्ड / Password'}</label><input id="portal-password" type="password" required minLength={activation?16:undefined} maxLength={128} autoComplete={activation?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></div>
    {activation&&<div className="field"><label htmlFor="portal-confirm">पासवर्ड फिर लिखें / Confirm password</label><input id="portal-confirm" type="password" required minLength={16} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy}/></div>}
    {activation&&!hasToken&&<p role="status">पूरा आमंत्रण लिंक खोलें। लिंक का # भाग आवश्यक है। / Open the complete invitation link, including its # fragment.</p>}
    <div ref={challengeContainer} aria-label="Cloudflare security check"/>
    {(error||challengeError)&&<p role="alert" className="form-error">{error||challengeError}</p>}
    {me&&!me.siteKey&&<p role="status">लॉग इन अभी उपलब्ध नहीं है। / Sign-in is not available yet.</p>}
    <button className="primary" disabled={busy||!challengeReady||(activation&&!hasToken)}>{busy?'जांच हो रही है… / Checking…':activation?'खाता सक्रिय करें / Activate account':'लॉग इन / Sign in'}</button>
  </form>;
}
