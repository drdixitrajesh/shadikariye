import {env} from 'cloudflare:workers';
import {getChatGPTUser,type ChatGPTUser} from '@/app/chatgpt-auth';
function entries(value:string|undefined){return (value??'').split(',').map(s=>s.trim()).filter(Boolean);}
export function isAdmin(user:ChatGPTUser|null){
  if(!user)return false;
  return entries(env.ADMIN_USER_IDS).includes(user.userId)||entries(env.ADMIN_EMAILS).map(s=>s.toLowerCase()).includes(user.email.trim().toLowerCase());
}
export async function adminIdentity(){const user=await getChatGPTUser();return isAdmin(user)?user:null;}
