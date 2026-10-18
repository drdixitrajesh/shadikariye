'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {portalApi} from './client';
type Account={id:string;username:string;role:string;status:string};
type Audit={actor?:string;target?:string;created_at?:number;at?:number;action?:string;reason?:string;username?:string;accountId?:string};
type AccountsPage={accounts:Account[];audit:Audit[]};
export default function AdminAccounts(){
  const [page,setPage]=useState<AccountsPage|null>(null),[target,setTarget]=useState(''),[reason,setReason]=useState(''),[url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  async function load(){try{setPage(await portalApi<AccountsPage>('/api/portal/admin/accounts'));}catch(e){setError((e as Error).message);}}
  useEffect(()=>{setTarget(new URLSearchParams(window.location.search).get('member')??'');void portalApi<AccountsPage>('/api/portal/admin/accounts').then(setPage).catch(e=>setError((e as Error).message));},[]);
  async function issue(event:FormEvent){event.preventDefault();setBusy(true);setError('');setUrl('');try{const result=await portalApi<{activationUrl?:string;url?:string}>('/api/portal/admin/accounts',{accountId:target,reason});setUrl(result.activationUrl??result.url??'');setReason('');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="security-panel"><h2>सदस्य की लॉगिन सहायता</h2><p>पासवर्ड भूलने वाले सदस्य के लिए नया सेटअप लिंक बनाएं। इससे उनका पुराना पासवर्ड और लॉगिन सत्र बंद हो जाएगा। खाता सक्रिय करना बाकी हो तो इसी लिंक से सदस्य अपना पासवर्ड बना सकता है।</p>
    {page&&<><form onSubmit={issue}><div className="field"><label htmlFor="invite-account">खाता / Account</label><select id="invite-account" required value={target} onChange={e=>{setTarget(e.target.value);setUrl('');}} disabled={busy}><option value="">खाता चुनें / Choose account</option>{page.accounts.filter(a=>a.role!=='admin').map(a=><option key={a.id} value={a.id}>{a.username} ({a.role})</option>)}</select></div><div className="field"><label htmlFor="invite-reason">आमंत्रण या रीसेट का कारण / Invitation or reset reason</label><textarea id="invite-reason" required minLength={10} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></div><button className="primary" disabled={busy||!target||reason.trim().length<10}>पासवर्ड सेटअप लिंक बनाएं</button></form></>}
    {url&&<div className="admin-notice"><p>यह गुप्त लिंक अब ही दिखाया जाता है। इच्छित खाता धारक को निजी रूप से साझा करें। / This secret link is shown only now. Share it privately with the intended account holder.</p><div className="field"><label htmlFor="activation-link">सक्रियकरण लिंक / Activation link</label><textarea id="activation-link" readOnly value={url} rows={3}/></div><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(url);setNotice('लिंक कॉपी हो गया। / Link copied.');}catch{setNotice('टेक्स्ट चुनकर कॉपी करें। / Select and copy the text.');}}}>लिंक कॉपी करें / Copy link</button><button className="text-button" onClick={()=>setUrl('')}>लिंक छिपाएं / Hide link</button></div>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="form-error">{error}</p>}
    {Boolean(page?.audit.length)&&<details><summary>सुरक्षा रिकॉर्ड / Audit records</summary><ul>{page!.audit.map((a,i)=><li key={i}>{a.created_at?new Date(a.created_at).toLocaleString():''} · {a.action} · {a.actor} → {a.target??a.username??a.accountId} · {a.reason}</li>)}</ul></details>}
  </section>;
}
