'use client';
import {useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
import {installPrivacyShield} from '../lib/privacy-shield';

export default function PhotoCopyGuard(){
  const screen=useRef<HTMLDialogElement>(null);
  const pathname=usePathname();
  useEffect(()=>{
    if(!screen.current)return;
    return installPrivacyShield(screen.current,pathname);
  },[pathname]);
  return <dialog ref={screen} className="privacy-screen" aria-labelledby="privacy-screen-title" aria-describedby="privacy-screen-description">
    <div className="privacy-screen-message">
      <h2 id="privacy-screen-title">गोपनीयता के लिए स्क्रीन छिपाई गई है</h2>
      <p id="privacy-screen-description">कुछ स्क्रीनशॉट शॉर्टकट दबाने पर सामग्री छिप जाती है।</p>
      <button type="button" data-privacy-resume>स्क्रीन फिर खोलें / Show screen</button>
    </div>
  </dialog>;
}
