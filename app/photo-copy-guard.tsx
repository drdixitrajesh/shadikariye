'use client';
import {useEffect} from 'react';

export default function PhotoCopyGuard(){
  useEffect(()=>{
    const photo=(target:EventTarget|null)=>target instanceof Element&&!target.closest('input,textarea,[contenteditable="true"]')&&Boolean(target.closest('img,.portrait,.photo-wrap,.member-photo-gallery,.detail-photos,.profile-card,.detail-sheet,.member-preview-section'));
    const preventPhotoCopy=(event:Event)=>{if(photo(event.target))event.preventDefault();};
    document.addEventListener('contextmenu',preventPhotoCopy);document.addEventListener('dragstart',preventPhotoCopy);document.addEventListener('selectstart',preventPhotoCopy);
    return ()=>{document.removeEventListener('contextmenu',preventPhotoCopy);document.removeEventListener('dragstart',preventPhotoCopy);document.removeEventListener('selectstart',preventPhotoCopy);};
  },[]);
  return null;
}
