import {env} from 'cloudflare:workers';
import {getChatGPTUser,type ChatGPTUser} from '@/app/chatgpt-auth';
import {portalUser} from './portal-context';
function entries(value:string|undefined){return (value??'').split(',').map(s=>s.trim()).filter(Boolean);}
export function isAdmin(user:ChatGPTUser|null){
  if(!user)return false;
  if(env.STANDALONE_MODE==='test-portal'){const session=portalUser();return session?.id===user.userId&&session.role==='admin'&&session.mfa;}
  return entries(env.ADMIN_USER_IDS).includes(user.userId)||entries(env.ADMIN_EMAILS).map(s=>s.toLowerCase()).includes(user.email.trim().toLowerCase());
}
export async function adminIdentity(){const user=await getChatGPTUser();return isAdmin(user)?user:null;}
