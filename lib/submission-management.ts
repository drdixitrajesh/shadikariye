import {db} from './store';
import {digest} from './portal-auth';
export type ManagedSubmission={id:string;owner:string;data:string;photo_key:string|null;updated_at:number;expires_at:number;hash:string};
export async function managedSubmission(token:unknown):Promise<ManagedSubmission|null>{
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
  const hash=await digest(token),now=Date.now();
  const row=await db().prepare("SELECT p.id,p.owner,p.data,p.photo_key,p.updated_at,p.expires_at FROM submission_access a JOIN profiles p ON p.owner=a.owner JOIN portal_accounts u ON u.id=p.owner WHERE a.token_hash=? AND a.expires_at>? AND p.expires_at>? AND u.role='member' AND u.status='invited' AND u.password_hash IS NULL").bind(hash,now,now).first<Omit<ManagedSubmission,'hash'>>();
  return row?{...row,hash}:null;
}
