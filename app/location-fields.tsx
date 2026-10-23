'use client';
import {useEffect,useId,useState} from 'react';
import countries from '../public/locations/countries.json';
export type LocationValue={country:string;state:string;district:string};
type Region={states:string[];districts:Record<string,string[]>};
type Translate=(hi:string,en:string)=>string;
const cache=new Map<string,Promise<Region>>();
function useRegions(country:string){
  const [result,setResult]=useState<{country:string;data?:Region;error?:boolean}>({country:''});
  const [attempt,retry]=useState(0);
  const code=countries.find(c=>c.name===country)?.code;
  useEffect(()=>{
    if(!code)return;
    let current=true;
    let request=cache.get(code);
    if(!request){
      request=fetch('/locations/'+code+'.json').then(response=>{
        if(!response.ok)throw new Error('Location list unavailable');return response.json() as Promise<Region>;
      });cache.set(code,request);
      request.catch(()=>cache.delete(code));
    }
    request.then(data=>{if(current)setResult({country,data});},()=>{if(current)setResult({country,error:true});});
    return ()=>{current=false;};
  },[code,country,attempt]);
  return {data:result.country===country?result.data:undefined,error:result.country===country&&result.error,loading:Boolean(code)&&(result.country!==country||(!result.data&&!result.error)),retry:()=>retry(n=>n+1)};
}

export function LocationSelect({label,value,onChange,options,placeholder,disabled=false,required=false,custom=false,t}:{label:string;value:string;onChange:(value:string)=>void;options:string[];placeholder:string;disabled?:boolean;required?:boolean;custom?:boolean;t:Translate}){
  const id=useId();
  const [other,setOther]=useState(false);
  const isOther=custom&&(other||Boolean(value&&!options.includes(value)));
  return <div className="field location-field"><label htmlFor={id}>{label}</label>
    <select id={id} value={isOther?'__other':value} required={required} disabled={disabled} onChange={event=>{
      if(event.target.value==='__other'){setOther(true);onChange('');}else{setOther(false);onChange(event.target.value);}
    }}>
      <option value="">{placeholder}</option>
      {options.map(option=><option key={option} value={option}>{option}</option>)}
      {custom&&<option value="__other">{t('अन्य / सूची में नहीं','Other / not listed')}</option>}
    </select>
    {isOther&&<input aria-label={t(label+' का नाम',label+' name')} value={value} maxLength={160} required disabled={disabled} onChange={event=>onChange(event.target.value)} placeholder={t('नाम लिखें','Enter name')}/>}
  </div>;
}

export function LocationFields({value,onChange,t}:{value:LocationValue;onChange:(value:LocationValue)=>void;t:Translate}){
  const region=useRegions(value.country);
  const states=region.data?.states??[];
  const districts=region.data?.districts[value.state]??[];
  return <fieldset className="location-fields"><legend>{t('स्थान','Location')}</legend><div className="location-grid">
    <LocationSelect label={t('देश','Country')} value={value.country} onChange={country=>onChange({country,state:'',district:''})} options={countries.map(c=>c.name)} placeholder={t('देश चुनें','Choose country')} required t={t}/>
    <LocationSelect key={value.country} label={t('राज्य / प्रांत','State / province')} value={value.state} onChange={state=>onChange({...value,state,district:''})} options={states} placeholder={!value.country?t('पहले देश चुनें','Choose country first'):region.loading?t('सूची लोड हो रही है…','Loading list…'):states.length?t('राज्य चुनें','Choose state'):t('लागू नहीं / अन्य चुनें','Not applicable / choose Other')} disabled={!value.country||region.loading||Boolean(region.error)} required={states.length>0} custom t={t}/>
    <LocationSelect key={value.country+'-'+value.state} label={t('ज़िला / काउंटी','District / county')} value={value.district} onChange={district=>onChange({...value,district})} options={districts} placeholder={districts.length?t('ज़िला चुनें','Choose district'):t('लागू नहीं / अन्य चुनें','Not applicable / choose Other')} disabled={!value.country||region.loading||Boolean(region.error)||(states.length>0&&!value.state)} required={districts.length>0} custom t={t}/>
  </div>
  {region.error&&<p role="alert">{t('स्थान सूची लोड नहीं हुई।','The location list could not be loaded.')} <button type="button" className="text-button" onClick={region.retry}>{t('फिर कोशिश करें','Retry')}</button></p>}
  <p className="location-source">{t('सूची में नाम न मिले तो “अन्य” चुनें। स्थान सूची: ','If a name is missing, choose Other. Location data: ')}<a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p>
  </fieldset>;
}

export function LocationFilters({value,onChange,t,locations=[]}:{value:LocationValue;onChange:(value:LocationValue)=>void;t:Translate;locations?:LocationValue[]}){
  const region=useRegions(value.country);
  const states=[...new Set([...(region.data?.states??[]),...locations.filter(p=>p.country===value.country).map(p=>p.state).filter(Boolean)])].sort((a,b)=>a.localeCompare(b));
  const districts=[...new Set([...(region.data?.districts[value.state]??[]),...locations.filter(p=>p.country===value.country&&p.state===value.state).map(p=>p.district).filter(Boolean)])].sort((a,b)=>a.localeCompare(b));
  return <>
    <LocationSelect label={t('देश','Country')} value={value.country} onChange={country=>onChange({country,state:'',district:''})} options={countries.map(c=>c.name)} placeholder={t('सभी देश','All countries')} t={t}/>
    <LocationSelect label={t('राज्य / प्रांत','State / province')} value={value.state} onChange={state=>onChange({...value,state,district:''})} options={states} placeholder={!value.country?t('पहले देश चुनें','Choose country first'):region.loading?t('सूची लोड हो रही है…','Loading list…'):t('सभी राज्य','All states')} disabled={!value.country||region.loading||Boolean(region.error)} t={t}/>
    <LocationSelect label={t('ज़िला / काउंटी','District / county')} value={value.district} onChange={district=>onChange({...value,district})} options={districts} placeholder={t('सभी ज़िले','All districts')} disabled={!value.state||region.loading||Boolean(region.error)} t={t}/>
    {region.error&&<p role="alert">{t('सूची उपलब्ध नहीं।','List unavailable.')} <button type="button" className="text-button" onClick={region.retry}>{t('फिर कोशिश करें','Retry')}</button></p>}
    <p className="location-source">{t('स्थान सूची: ','Location data: ')}<a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a></p>
  </>;
}
