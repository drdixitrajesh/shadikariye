// A copying deterrent, never an OS screenshot detector or access-control boundary.
export function installPrivacyShield(screen:HTMLDialogElement,pathname:string){
  const root=document.documentElement;
  const enabled=!/^\/(?:login|register|activate|forgot-password|terms)(?:\/|$)/.test(pathname);
  const photoSelector='img,.portrait,.photo-wrap,.member-photo-gallery,.detail-photos,.profile-card,.detail-sheet,.member-preview-section';
  const editable=(target:EventTarget|null)=>target instanceof Element&&Boolean(target.closest('input,textarea,[contenteditable]:not([contenteditable="false"])'));
  const protectedTarget=(target:EventTarget|null)=>target instanceof Element&&!editable(target)&&Boolean(target.closest(photoSelector));
  const preventPhotoCopy=(event:Event)=>{if(protectedTarget(event.target))event.preventDefault();};
  const preventClipboardCopy=(event:ClipboardEvent)=>{
    if(editable(event.target))return;
    const selection=window.getSelection();
    if(protectedTarget(event.target)||protectedTarget(selection?.anchorNode?.parentElement??null)||protectedTarget(selection?.focusNode?.parentElement??null))event.preventDefault();
  };
  const conceal=()=>{
    if(!enabled)return;
    // Change the DOM synchronously: do not wait for a React render or animation.
    root.dataset.privacyShield='hidden';
    if(!screen.open)screen.showModal();
  };
  const resume=()=>{
    if(document.visibilityState!=='visible'||!document.hasFocus())return;
    screen.close();
    delete root.dataset.privacyShield;
  };
  const onKey=(event:KeyboardEvent)=>{
    const key=event.key.toLowerCase();
    const capture=key==='printscreen'||event.code==='PrintScreen'||
      (event.metaKey&&event.shiftKey&&['s','3','4','5'].includes(key))||
      (event.ctrlKey&&event.shiftKey&&key==='s');
    if(enabled&&capture){event.preventDefault();conceal();}
  };
  const onCancel=(event:Event)=>event.preventDefault();
  const button=screen.querySelector<HTMLButtonElement>('[data-privacy-resume]');
  root.toggleAttribute('data-privacy-enabled',enabled);
  document.addEventListener('contextmenu',preventPhotoCopy);
  document.addEventListener('dragstart',preventPhotoCopy);
  document.addEventListener('selectstart',preventPhotoCopy);
  document.addEventListener('copy',preventClipboardCopy);
  document.addEventListener('cut',preventClipboardCopy);
  document.addEventListener('keydown',onKey,true);
  document.addEventListener('keyup',onKey,true);
  screen.addEventListener('cancel',onCancel);
  button?.addEventListener('click',resume);
  return ()=>{
    document.removeEventListener('contextmenu',preventPhotoCopy);
    document.removeEventListener('dragstart',preventPhotoCopy);
    document.removeEventListener('selectstart',preventPhotoCopy);
    document.removeEventListener('copy',preventClipboardCopy);
    document.removeEventListener('cut',preventClipboardCopy);
    document.removeEventListener('keydown',onKey,true);
    document.removeEventListener('keyup',onKey,true);
    screen.removeEventListener('cancel',onCancel);
    button?.removeEventListener('click',resume);
    screen.close();
    delete root.dataset.privacyShield;
    root.removeAttribute('data-privacy-enabled');
  };
}
