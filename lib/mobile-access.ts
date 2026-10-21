import {env} from 'cloudflare:workers';
import {normalizeMobile} from './account-contact';
import type {PortalUser} from './portal-context';

export function requiresAccountMobile(){return env.STANDALONE_MODE==='test-portal'&&env.REQUIRE_ACCOUNT_MOBILE!=='0';}
const publicPages=new Set(['/login','/register','/activate','/account','/terms']);
const accountApis=new Set(['/api/portal/me','/api/portal/login','/api/portal/register','/api/portal/activate','/api/portal/logout','/api/portal/contact','/api/portal/mfa']);

export async function mobileAccessGate(request:Request,user:PortalUser|null){
  if(!requiresAccountMobile())return null;
  const url=new URL(request.url),path=url.pathname;
  // Only application code/styles/fonts and account setup are public. Photos,
  // directory/profile pages, RSC requests and every data API use this same gate.
  if(publicPages.has(path)||accountApis.has(path)||path.startsWith('/_next/static/')||path==='/favicon.ico')return null;
  let mobile='';
  if(user){const row=await env.DB!.prepare('SELECT mobile FROM portal_accounts WHERE id=? AND status=\'active\'').bind(user.id).first<{mobile:string|null}>();mobile=normalizeMobile(row?.mobile);}
  if(user&&mobile)return null;
  const location=user?'/account':'/login',status=user?403:401;
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
  if(path.startsWith('/api/'))return Response.json({error:user?'वेबसाइट की जानकारी देखने से पहले मेरा खाता खोलकर मोबाइल नंबर जोड़ें। / Add your mobile number in My account first.':'जानकारी देखने के लिए मोबाइल नंबर वाले खाते से लॉग इन करें। / Sign in with an account that has a mobile number.',code:user?'MOBILE_REQUIRED':'SIGN_IN_REQUIRED',redirect:location},{status,headers});
  return new Response(null,{status:303,headers:{...headers,Location:location}});
}
