export function consumeActivationToken(location:{hash:string;pathname:string;search:string},history:{replaceState:(data:null,unused:string,url:string)=>void}):string {
  const fragment=location.hash.slice(1);
  const token=fragment.startsWith('token=')?new URLSearchParams(fragment).get('token')??'':fragment;
  history.replaceState(null,'',location.pathname);
  return /^[A-Za-z0-9_-]{32,256}$/.test(token)?token:'';
}
export function passwordError(password:string,confirmation:string):string {
  if(password.length<16||password.length>128)return 'पासवर्ड 16–128 अक्षरों का रखें। / Use 16–128 characters.';
  if(password!==confirmation)return 'दोनों पासवर्ड समान होने चाहिए। / Passwords must match.';
  return '';
}
