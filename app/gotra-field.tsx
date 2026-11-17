'use client';
import {useState} from 'react';
import {GOTRAS,HINDI,canonicalGotra} from '@/lib/matrimony';
export default function GotraField({initial='Unknown'}:{initial?:string}){
  const canonical=canonicalGotra(initial),known=GOTRAS.includes(canonical)||canonical==='Unknown';
  const [choice,setChoice]=useState(known?canonical:'Other'),[custom,setCustom]=useState(known?'':initial);
  return <div className="post-gotra-field"><label htmlFor="post-gotra">गोत्र</label><select id="post-gotra" name={choice==='Other'?undefined:'gotra'} value={choice} onChange={e=>setChoice(e.target.value)} required><option value="Unknown">पता नहीं</option>{[...GOTRAS].sort((a,b)=>(HINDI[a]??a).localeCompare(HINDI[b]??b,'hi')).map(g=><option key={g} value={g}>{HINDI[g]??g} ({g})</option>)}<option value="Other">अन्य गोत्र - अपना नाम लिखें</option></select>{choice==='Other'&&<><label htmlFor="post-gotra-other">अपना गोत्र लिखें</label><input id="post-gotra-other" name="gotra" required minLength={2} maxLength={60} value={custom} onChange={e=>setCustom(e.target.value)} placeholder="गोत्र का नाम"/></>}<small>परिवार से पुष्टि करके चुनें। सूची में न मिले तो “अन्य गोत्र” चुनें।</small></div>;
}
