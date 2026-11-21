import {env} from 'cloudflare:workers';
import {normalizeMobile} from './account-contact';
import type {PortalUser} from './portal-context';

export function requiresAccountMobile(){return env.STANDALONE_MODE==='test-portal'&&env.REQUIRE_ACCOUNT_MOBILE!=='0';}
const publicPages=new Set(['/','/portraits.png','/login','/register','/post','/post/privacy','/post/recover','/kundali-milan','/licenses/astronomy-engine.txt','/licenses/NotoSansDevanagari.txt','/iphone-app','/downloads/vedik-milan-1.0.0.apk','/.well-known/assetlinks.json','/manifest.webmanifest','/sw.js','/offline.html','/icons/app-180.png','/icons/app-192.png','/icons/app-512.png','/icons/app-maskable.png','/fonts/NotoSansDevanagari.ttf','/forgot-password','/activate','/account','/terms']);
const publicArtwork=new Set(['/vedik-milan-hero.webp','/vedik-milan-hero-small.webp']);
const accountApis=new Set(['/api/portal/me','/api/portal/login','/api/portal/register','/api/portal/recover','/api/portal/activate','/api/portal/logout','/api/portal/contact','/api/portal/mfa']);

export async function accountHasMobile(user:PortalUser|null){
  if(!user)return false;
  const row=await env.DB!.prepare("SELECT mobile FROM portal_accounts WHERE id=? AND status='active'").bind(user.id).first<{mobile:string|null}>();
  return Boolean(normalizeMobile(row?.mobile));
}

export async function mobileAccessGate(request:Request,user:PortalUser|null){
  if(!requiresAccountMobile())return null;
  const url=new URL(request.url),path=url.pathname;
  // Public reads use their own approved, consented profile projection.
  // Every member mutation, private API and administration still uses this gate.
  const publicRead=(request.method==='GET'||request.method==='HEAD')&&(publicArtwork.has(path)||path==='/api/state'||/^\/api\/photo\/[0-9a-f-]{36}$/.test(path)||/^\/locations\/(?:[A-Z]{2}|countries|source)\.json$/.test(path));
  if(publicRead||(['/api/submissions','/api/submissions/privacy','/api/submissions/manage','/api/submissions/recover'].includes(path)&&request.method==='POST'))return null;
  if(publicPages.has(path)||accountApis.has(path)||path.startsWith('/_next/static/')||path==='/favicon.ico')return null;
  if(await accountHasMobile(user))return null;
  const location=user?'/account':'/login',status=user?403:401;
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
  if(path.startsWith('/api/'))return Response.json({error:user?'इस सदस्य सुविधा के लिए मेरा खाता खोलकर मोबाइल नंबर जोड़ें। / Add your mobile number in My account to use member features.':'इस सदस्य सुविधा के लिए लॉग इन करें। / Sign in to use this member feature.',code:user?'MOBILE_REQUIRED':'SIGN_IN_REQUIRED',redirect:location},{status,headers});
  return new Response(null,{status:303,headers:{...headers,Location:location}});
}
