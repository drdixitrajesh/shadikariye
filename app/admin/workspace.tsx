'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,Search,RefreshCw,ChevronRight,Flower2} from 'lucide-react';
import {LogoutButton} from '../portal/client';
import {SubmissionRecoveryQueue} from './submission-recovery';
import AdminAccounts from '../portal/admin-accounts';
import {adminRead,dateLabel,type AdminSection,type MembersPage} from './member-types';

export function AdminHeader(){return <div className="backoffice-top"><a className="backoffice-brand" href="/admin"><Flower2 size={25}/><span>वैदिक मिलन <small>प्रशासन</small></span></a><nav aria-label="प्रशासक खाता"><a href="/">वेबसाइट देखें</a><a href="/account">मेरा खाता</a><LogoutButton label="लॉग आउट"/></nav></div>;}
export default function AdminWorkspace({section}:{section:AdminSection}){
  const [data,setData]=useState<MembersPage|null>(null),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[tests,setTests]=useState(false),[before,setBefore]=useState<string|null>(null),[history,setHistory]=useState<(string|null)[]>([]),[version,setVersion]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const pendingOnly=section==='pending';
  useEffect(()=>{
    if(section==='help')return;
    const params=new URLSearchParams({q:search,tests:pendingOnly||tests?'1':'0',pending:pendingOnly?'1':'0'});
    if(before)params.set('before',before);
    let request:AbortController|null=null;
    async function load(quiet=false){
      if(request)return;
      const controller=new AbortController();
      request=controller;
      if(!quiet){setLoading(true);setError('');}
      try{
        const page=await adminRead<MembersPage>('/api/admin/members?'+params,controller.signal);
        if(!controller.signal.aborted){setData(page);setError('');}
      }catch(error){
        if(!controller.signal.aborted&&!quiet)setError((error as Error).message);
      }finally{
        if(request===controller)request=null;
        if(!quiet&&!controller.signal.aborted)setLoading(false);
      }
    }
    void load();
    function refreshQueue(){if(document.visibilityState==='visible')void load(true);}
    const watchQueue=pendingOnly&&!before;
    const timer=watchQueue?window.setInterval(refreshQueue,30000):undefined;
    if(watchQueue)document.addEventListener('visibilitychange',refreshQueue);
    return()=>{
      request?.abort();
      if(timer!==undefined)window.clearInterval(timer);
      if(watchQueue)document.removeEventListener('visibilitychange',refreshQueue);
    };
  },[section,search,tests,pendingOnly,before,version]);
  function find(event:FormEvent){event.preventDefault();setHistory([]);setBefore(null);setSearch(query.trim());setVersion(v=>v+1);}
  return <main className="backoffice"><AdminHeader/><header className="backoffice-heading"><div><h1>सदस्य और प्रोफ़ाइल</h1><a className="secondary" href="/admin/post">नई प्रोफ़ाइल सीधे पोस्ट करें</a><p>किसने खाता बनाया, किसने पोस्ट की और उनकी प्रोफ़ाइल कैसी दिखती है—एक जगह देखें।</p></div></header>
    <nav className="backoffice-tabs" aria-label="प्रशासन के भाग">
      <a href="/admin" aria-current={pendingOnly?'page':undefined}>मंज़ूरी बाकी{data?' ('+data.summary.pending+')':''}</a>
      <a href="/admin?section=members" aria-current={section==='members'?'page':undefined}>सभी सदस्य</a>
      <a href="/admin?section=help" aria-current={section==='help'?'page':undefined}>लॉगिन सहायता और सुरक्षा</a>
    </nav>
    {section==='help'?<section className="backoffice-section"><SubmissionRecoveryQueue/><AdminAccounts/></section>:<>
      {!pendingOnly&&<div className="member-summary" aria-live="polite">{data?<><strong>{data.summary.members} असली सदस्य</strong><span>{data.summary.profiles} जमा पोस्ट</span><span>{data.summary.testAccounts} परीक्षण खाते {tests?'दिख रहे हैं':'छिपे हैं'}</span></>:<span>सदस्यों की जानकारी लोड हो रही है…</span>}</div>}
      <form className="member-toolbar" onSubmit={find}><div className="member-search"><label htmlFor="member-search">सदस्य खोजें</label><div><Search size={18} aria-hidden="true"/><input id="member-search" maxLength={80} value={query} onChange={e=>setQuery(e.target.value)} placeholder="नाम, यूज़रनेम या शहर"/></div></div><button className="primary" disabled={loading}>खोजें</button><button className="secondary" type="button" disabled={loading} onClick={()=>setVersion(v=>v+1)}><RefreshCw size={16}/> रिफ्रेश</button>{!pendingOnly&&<label className="native-check"><input type="checkbox" checked={tests} onChange={e=>{setTests(e.target.checked);setHistory([]);setBefore(null);}}/>परीक्षण खाते भी दिखाएं</label>}</form>
      {error?<div className="backoffice-error" role="alert"><p>{error}</p><button className="secondary" onClick={()=>setVersion(v=>v+1)}>फिर प्रयास करें</button> <a href="/account">मेरा खाता खोलें</a></div>:loading?<div className="member-loading" role="status">सदस्य लोड हो रहे हैं…</div>:data&&<>
        <div className="member-results-heading"><h2>{search?'खोज के नतीजे':pendingOnly?'समीक्षा के लिए आई प्रोफ़ाइलें':'सभी सदस्य'}</h2><span>{data.total} {pendingOnly?'प्रोफ़ाइलें':'खाते'}</span></div>
        {data.members.length?<div className="member-list"><table><thead><tr><th>सदस्य</th><th>प्रोफ़ाइल की स्थिति</th><th>{pendingOnly?'समीक्षा के लिए भेजा':'खाता बना'}</th><th><span className="sr-only">कार्रवाई</span></th></tr></thead><tbody>{data.members.map(m=><tr key={m.id}><td data-label="सदस्य"><a className="member-name" href={'/admin/members/'+m.id}>{m.username}</a><span className="member-meta">{m.testAccount?'काल्पनिक परीक्षण खाता':m.status==='active'?'खाता सक्रिय है':m.status==='invited'?'खाता सक्रिय करना बाकी है':'खाता बंद है'}</span></td><td data-label="प्रोफ़ाइल">{m.profile?<><a className="published-name" href={'/admin/members/'+m.id+'#profile'}>{m.profile.name}</a><span className="member-meta">{m.profile.approvalStatus==='pending'?'मंज़ूरी बाकी':m.profile.approvalStatus==='rejected'?'सुधार माँगा गया':'स्वीकृत'} · {m.profile.city}</span></>:<span className="member-empty-profile">अभी कोई प्रकाशित प्रोफ़ाइल नहीं है</span>}</td><td data-label={pendingOnly?'समीक्षा के लिए भेजा':'खाता बना'}><time>{dateLabel(pendingOnly?m.profile?.updatedAt:m.createdAt)}</time></td><td>{pendingOnly?<a className="member-open" href={'/admin/members/'+m.id+'#profile'}>समीक्षा करें <ChevronRight size={17}/></a>:<><a className="member-open" href={'/admin/members/'+m.id}>प्रोफ़ाइल और गतिविधि <ChevronRight size={17}/></a><a className="member-open danger" href={'/admin/members/'+m.id+(m.profile?'#delete-profile':'#delete-account')}>{m.profile?'प्रोफ़ाइल हटाएँ':'खाता हटाएँ'}</a></>}</td></tr>)}</tbody></table></div>:<div className="member-empty"><h3>{pendingOnly?(search?'इस खोज से कोई लंबित प्रोफ़ाइल नहीं मिली':'अभी कोई प्रोफ़ाइल मंज़ूरी के लिए लंबित नहीं है'):'कोई सदस्य नहीं मिला'}</h3>{search&&<p>दूसरे नाम या यूज़रनेम से खोजें।</p>}</div>}
        <div className="member-pagination"><button className="secondary" disabled={!history.length} onClick={()=>{setBefore(history.at(-1)??null);setHistory(h=>h.slice(0,-1));}}><ArrowLeft size={16}/> पिछला</button><span>पृष्ठ {history.length+1}</span><button className="secondary" disabled={!data.nextCursor} onClick={()=>{setHistory(h=>[...h,before]);setBefore(data.nextCursor);}}>अगला <ArrowRight size={16}/></button></div>
      </>}
    </>}
  </main>;
}
