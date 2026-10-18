import {db,fromRow} from './store';
import {isPortal} from './portal-auth';
import {ageFromDate} from './security';
export function publiclyVisible(data:string,expiresAt:number){const profile=JSON.parse(data);return isPortal()&&profile.publicListing===true&&!profile.testAccount&&expiresAt>Date.now();}
export async function publicProfiles(){
  if(!isPortal())return [];
  const rows=await db().prepare("SELECT p.id,p.data,p.photo_key,p.published_at,p.expires_at,l.birth_date FROM profiles p LEFT JOIN identity_locks l ON l.owner=p.owner WHERE json_extract(p.data,'$.publicListing')=1 AND coalesce(json_extract(p.data,'$.testAccount'),0)=0 AND p.expires_at>? ORDER BY p.updated_at DESC,p.id DESC LIMIT 20").bind(Date.now()).all<{id:string;data:string;photo_key:string|null;published_at:number;expires_at:number;birth_date:string|null}>();
  const ids=rows.results.map(p=>p.id);
  const photos=ids.length?await db().prepare('SELECT profile_id,key,slot FROM profile_photos WHERE profile_id IN ('+ids.map(()=>'?').join(',')+') ORDER BY slot').bind(...ids).all<{profile_id:string;key:string;slot:number}>():{results:[]};
  return rows.results.map(row=>{
    const {email,...profile}=fromRow(row);
    if(row.birth_date)profile.age=ageFromDate(row.birth_date);
    const slots=photos.results.filter(photo=>photo.profile_id===row.id).map(({key,slot})=>({key,slot}));
    return {...profile,photoSlots:slots,photoKeys:[...new Set([...(row.photo_key?[row.photo_key]:[]),...slots.map(photo=>photo.key)])]};
  });
}
