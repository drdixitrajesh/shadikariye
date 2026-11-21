'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {COMMUNITIES,HINDI,type Reference} from '@/lib/matrimony';
import GotraField from '../gotra-field';
import {ReferenceFields} from '../profile-security';
import {LocationFields} from '../location-fields';
import {useTurnstile} from '../portal/client';
import {prepareTestPhoto} from '../portal/photo';
const t=(hi:string,_en:string)=>hi;
export function PostingHelp(){return <aside className="posting-help"><strong>फॉर्म भरने में दिक़्क़त आ रही है?</strong><p>Admin Mob: <a href="tel:+919131591131">9131591131</a> पर अपना बायोडाटा भेज दें, हम आपकी प्रोफ़ाइल पोस्ट कर देंगे।</p><a href="https://wa.me/919131591131" target="_blank" rel="noopener noreferrer">WhatsApp पर बायोडाटा भेजें</a></aside>;}
export type PostEdit={token:string;revision:number;profile:Record<string,unknown>;photos:{slot:number;key:string}[];onSaved:()=>void};
function PrivatePhoto({token,photoKey}:{token:string;photoKey:string}){
  const [url,setUrl]=useState('');
  useEffect(()=>{let active=true,objectUrl='';const controller=new AbortController();void fetch('/api/submissions/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,action:'photo',key:photoKey}),signal:controller.signal}).then(async r=>{if(!r.ok)return;objectUrl=URL.createObjectURL(await r.blob());if(active)setUrl(objectUrl);else URL.revokeObjectURL(objectUrl);}).catch(()=>{});return()=>{active=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[token,photoKey]);
  return url?<img src={url} alt="पहले से जोड़ी हुई फोटो"/>:<span>फोटो लोड हो रही है…</span>;
}
export default function PostForm({siteKey='',admin=false,edit}:{siteKey?:string;admin?:boolean;edit?:PostEdit}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<{profileId:string;memberId:string;approvalStatus:string;managementToken?:string}|null>(null);
  const confirmationHeading=useRef<HTMLHeadingElement>(null);
  const initial=edit?.profile;
  const [about,setAbout]=useState(String(initial?.about??''));
  const [keepPhotos,setKeepPhotos]=useState<string[]>(edit?.photos.map(p=>p.key)??[]);
  const [photoNames,setPhotoNames]=useState<string[]>([]);
  const [location,setLocation]=useState({country:String(initial?.country??'India'),state:String(initial?.state??''),district:String(initial?.district??'')});
  const [refs,setRefs]=useState<Reference[]>(Array.from({length:2},(_,i)=>(initial?.references as Reference[]|undefined)?.[i]??({name:'',relationship:'',phone:'',consent:false})));
  const challenge=useTurnstile(admin||edit||result?'':siteKey,'post');
  useEffect(()=>{
    if(!result)return;
    confirmationHeading.current?.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  },[result]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setError('');
    try{
      const turnstile=admin||edit?undefined:await challenge.execute();
      const files=form.getAll('photo').filter((f):f is File=>f instanceof File&&f.size>0);
      if(files.length>5)throw new Error('अधिकतम पाँच फोटो चुनें।');
      const photos=await Promise.all(files.map(prepareTestPhoto));
      const values=Object.fromEntries(form.entries());
      const body={...values,...location,height:Number(values.height),aadhaarLast4:String(initial?.aadhaarLast4??''),references:refs.filter(r=>r.name||r.relationship||r.phone||r.consent),termsAccepted:form.has('termsAccepted'),consent:form.has('consent'),publicListing:form.has('publicListing'),turnstile};

      const upload=new FormData();upload.set('details',JSON.stringify(edit?{action:'update',token:edit.token,revision:edit.revision,keepPhotos,profile:body}:body));photos.forEach(f=>upload.append('photo',f));
      const response=await fetch(edit?'/api/submissions/manage':'/api/submissions',{method:'POST',body:upload});
      const data=await response.json() as {profileId:string;memberId:string;approvalStatus:string;managementToken?:string;error?:string};if(!response.ok)throw new Error(data.error??'पोस्ट नहीं भेजी गई। फिर प्रयास करें।');if(edit){edit.onSaved();return;}setResult(data);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(result)return <section className="post-success" aria-labelledby="post-confirmation-title">
    <h1 id="post-confirmation-title" ref={confirmationHeading} tabIndex={-1}>
      {result.approvalStatus==='approved'?'प्रोफ़ाइल पोस्ट कर दी गई':'प्रोफ़ाइल मंज़ूरी के लिए भेज दी गई'}
    </h1>
    <p>{result.approvalStatus==='approved'?'पोस्ट स्वीकृत है और पात्र सदस्यों की सूची में उपलब्ध है।':'Admin की स्वीकृति के बाद आपकी पोस्ट सदस्यों को दिखाई देगी।'}</p>
    <p>पोस्ट ID: {result.profileId}</p>
    {result.managementToken&&<aside className="posting-help">
      <strong>अपनी प्रोफ़ाइल सँभालने का निजी लिंक सुरक्षित रखें</strong>
      <p>इस लिंक से बिना login जानकारी और फोटो बदल सकते हैं, सार्वजनिक अनुमति बदल सकते हैं या प्रोफ़ाइल हटा सकते हैं। इसे किसी दूसरे व्यक्ति से साझा न करें।</p>
      <a href={'/post/privacy#'+result.managementToken}>मेरी प्रोफ़ाइल सँभालें</a>
      <p><button className="secondary" type="button" onClick={async()=>{
        try{
          await navigator.clipboard.writeText(window.location.origin+'/post/privacy#'+result.managementToken);
          setError('निजी लिंक कॉपी हो गया। इसे सुरक्षित रखें।');
        }catch{
          setError('ऊपर के निजी लिंक को खोलकर सुरक्षित रखें।');
        }
      }}>निजी लिंक कॉपी करें</button></p>
      {error&&<p role="status">{error}</p>}
    </aside>}
    <p>निजी लिंक खो जाए या नाम / जन्म तिथि में सुधार चाहिए तो Admin Mob: <a href="tel:+919131591131">9131591131</a> पर संपर्क करें।</p>
    {admin?<a className="primary" href={'/admin/members/'+result.memberId}>पोस्ट और सदस्य की जानकारी देखें</a>:<a href="/">वेबसाइट पर वापस जाएँ</a>}{' '}
    <a href={admin?'/admin/post':'/post'}>एक और पोस्ट भरें</a>
  </section>;
  return <><header className="post-heading"><p>पूर्णतः निःशुल्क</p><h1>{edit?'प्रोफ़ाइल में बदलाव करें':admin?'सदस्य की ओर से प्रोफ़ाइल पोस्ट करें':'अपनी प्रोफ़ाइल पोस्ट करें'}</h1><p>{edit?'बदलाव के बाद पोस्ट फिर से Admin approval के लिए जाएगी। नाम, जन्म तिथि और संपर्क मोबाइल में सुधार के लिए Admin से संपर्क करें।':admin?'व्यक्ति की सहमति से जानकारी भरें। आपकी पोस्ट सीधे स्वीकृत होकर प्रकाशित होगी।':'लॉगिन या पासवर्ड की ज़रूरत नहीं। जानकारी भरकर Admin approval के लिए भेजें।'}</p></header>{!edit&&<p><a href="/post/recover">पहले पोस्ट कर चुके हैं और निजी लिंक खो गया है? सहायता लें</a></p>}<PostingHelp/>{!edit&&<p><a href="/kundali-milan">जन्म जानकारी से निःशुल्क कुण्डली मिलान करें</a></p>}
    <form className="simple-post-form" onSubmit={submit}><fieldset disabled={busy}><legend>1. व्यक्ति की जानकारी</legend><div className="post-fields">
      <label>पूरा नाम<input name="name" defaultValue={initial?.name===undefined?undefined:String(initial.name)} readOnly={Boolean(edit)} autoComplete="name" required minLength={2} maxLength={80}/></label>
      <label>जन्म तिथि<input name="birthDate" defaultValue={initial?.birthDate===undefined?undefined:String(initial.birthDate)} readOnly={Boolean(edit)} type="date" required/><small>वर: कम से कम 21 वर्ष पूरे। वधू: कम से कम 18 वर्ष पूरे। अधिकतम उम्र 70 वर्ष। जन्म तिथि निजी रहेगी।</small></label>
      <label>वर / वधू<select name="gender" defaultValue={initial?.gender===undefined?undefined:String(initial.gender)}><option value="female">वधू</option><option value="male">वर</option></select></label>
      <label>वैवाहिक स्थिति<select name="maritalStatus" defaultValue={initial?.maritalStatus===undefined?undefined:String(initial.maritalStatus)}><option value="Never married">अविवाहित</option><option value="Divorced">तलाकशुदा</option><option value="Widowed">विधवा / विधुर</option></select></label>
      <label>संपर्क मोबाइल<input name="mobile" defaultValue={initial?.mobile===undefined?undefined:String(initial.mobile)} readOnly={Boolean(edit)} type="tel" autoComplete="tel" required maxLength={30} placeholder="10 अंकों वाला भारतीय नंबर"/><small>सिर्फ Admin की सहायता के लिए; प्रोफ़ाइल पर नहीं दिखेगा।</small></label>
      <label>कद (cm)<input name="height" defaultValue={initial?.height===undefined?undefined:String(initial.height)} type="number" required min={120} max={230} placeholder="जैसे 165"/></label>
      <label>समुदाय / उपजाति<input name="community" defaultValue={initial?.community===undefined?undefined:String(initial.community)} list="post-communities" required minLength={2} maxLength={60} placeholder="चुनें या लिखें"/><datalist id="post-communities">{COMMUNITIES.map(c=><option key={c} value={c}>{HINDI[c]??c}</option>)}</datalist></label>
      <GotraField initial={String(initial?.gotra??'Unknown')}/>
    </div></fieldset><fieldset disabled={busy}><legend>2. स्थान और परिचय</legend><div className="post-fields"><LocationFields value={location} onChange={setLocation} t={t}/><label>शहर / गाँव<input name="city" defaultValue={initial?.city===undefined?undefined:String(initial.city)} required minLength={2} maxLength={80}/></label><label>पढ़ाई<input name="education" defaultValue={initial?.education===undefined?undefined:String(initial.education)} required minLength={2} maxLength={100} placeholder="जैसे B.A., M.Com."/></label><label>पेशा<input name="profession" defaultValue={initial?.profession===undefined?undefined:String(initial.profession)} required minLength={2} maxLength={100} placeholder="जैसे शिक्षक, व्यवसाय, विद्यार्थी"/></label></div><label>अपने बारे में / बायोडाटा<textarea name="about" value={about} onChange={e=>setAbout(e.target.value)} aria-describedby="post-about-count" rows={5} required minLength={20} maxLength={1500} placeholder="परिवार, रुचियाँ और जीवनसाथी से अपेक्षाएँ लिखें (20 से 1,500 अक्षर)।"/><small id="post-about-count">{about.length.toLocaleString('hi-IN')} / 1,500 अक्षर · न्यूनतम 20, अधिकतम 1,500 अक्षर</small></label></fieldset>
    <details className="post-optional"><summary>अतिरिक्त जानकारी और रेफरेंस (वैकल्पिक)</summary><fieldset disabled={busy}><div className="post-fields"><label>प्रोफ़ाइल कौन संभालता है<select name="managedBy" defaultValue={String(initial?.managedBy??'Self')}><option value="Self">स्वयं</option><option value="Parent">माता-पिता</option><option value="Sibling">भाई / बहन</option></select></label><label>भाषा<input name="language" defaultValue={String(initial?.language??'Hindi')} minLength={2} maxLength={60}/></label><label>प्रोफ़ाइल का संपर्क ईमेल (वैकल्पिक)<input name="email" defaultValue={initial?.email===undefined?undefined:String(initial.email)} type="email" maxLength={254}/><small>देने पर प्रोफ़ाइल देख सकने वाले सदस्यों को दिखेगा।</small></label></div><ReferenceFields value={refs} onChange={setRefs} t={t}/></fieldset></details>
    <fieldset disabled={busy}><legend>3. फोटो (वैकल्पिक)</legend>{edit&&<div className="post-photo-choices">{edit.photos.map((photo,i)=><label key={photo.key}><PrivatePhoto token={edit.token} photoKey={photo.key}/><span><input type="checkbox" checked={keepPhotos.includes(photo.key)} onChange={e=>setKeepPhotos(keys=>e.target.checked?[...keys,photo.key]:keys.filter(k=>k!==photo.key))}/> फोटो {i+1} रखें</span></label>)}</div>}{edit&&<p>फोटो हटाने के लिए “रखें” का निशान हटाएँ और बदलाव भेजें। पहली रखी हुई फोटो मुख्य फोटो होगी। पुरानी और नई मिलाकर अधिकतम पाँच फोटो रखें।</p>}<label>{edit?'नई फोटो जोड़ें':'अधिकतम पाँच फोटो'}<input name="photo" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>setPhotoNames(Array.from(e.target.files??[]).map(f=>f.name))}/><small>हर फोटो अधिकतम 4 MB। पहली फोटो मुख्य फोटो होगी।</small></label>{photoNames.length>0&&<p>{photoNames.join(" · ")}</p>}</fieldset>
    <fieldset disabled={busy} className="post-consent"><legend>4. गोपनीयता और सहमति</legend>{!edit&&<><p>प्रोफ़ाइल Admin की स्वीकृति के बाद दिखेगी।</p><label><input name="publicListing" type="checkbox" aria-describedby="post-public-help"/><span><strong>व्यक्ति की सहमति से प्रोफ़ाइल बिना लॉगिन सभी को दिखाएँ।</strong> (वैकल्पिक)</span></label><div id="post-public-help" className="post-public-help"><p>टिक न लगाएँ तो केवल लॉगिन किए हुए सदस्य देख सकेंगे। निजी संपर्क, जन्म तिथि और रेफरेंस सार्वजनिक नहीं होंगे। निजी लिंक से अनुमति बाद में बदल सकते हैं।</p></div></>}{edit&&<p>सार्वजनिक दिखाने की अनुमति ऊपर के गोपनीयता विकल्प से बदलें।</p>}<label><input name="termsAccepted" type="checkbox" required/><span>मैं <a href="/terms" target="_blank" rel="noopener noreferrer">नियम और गोपनीयता</a> स्वीकार करता/करती हूँ।</span></label><label><input name="consent" type="checkbox" required/><span>मैं पुष्टि करता/करती हूँ कि इस प्रोफ़ाइल में <strong>वर की उम्र कम से कम 21 वर्ष</strong> अथवा <strong>वधू की उम्र कम से कम 18 वर्ष</strong> पूरी हो चुकी है। संबंधित व्यक्ति ने अपनी जानकारी और फोटो वेबसाइट के सदस्यों के साथ साझा करने की सहमति दी है।</span></label><p>पोस्ट छह महीने बाद अपने आप हट जाएगी। नाम और जन्म तिथि सहेजने के बाद बदलवाने के लिए Admin से संपर्क करें।</p></fieldset>
    {!admin&&!edit&&<div ref={challenge.container}/>}<div aria-live="polite">{(error||challenge.error)&&<p className="form-error" role="alert">{error||challenge.error}</p>}</div>
    <div role="status">{busy&&<p>कृपया पुष्टि संदेश आने तक यह पेज खुला रखें।</p>}</div>
    <button className="primary" disabled={busy||(!admin&&!edit&&!challenge.ready)}>{busy?'पोस्ट भेज रहे हैं…':edit?'बदलाव Admin approval के लिए भेजें':admin?'पोस्ट प्रकाशित करें':'Admin approval के लिए भेजें'}</button>
    </form></>;
}
