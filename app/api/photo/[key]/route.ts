import {db,bucket,identity,json,errorResponse} from '@/lib/store';
import {blocked,hasView} from '@/lib/security';
export async function GET(request:Request,{params}:{params:Promise<{key:string}>}){
  const owner=await identity();if(!owner)return json({error:'Sign in required'},401);
  const {key}=await params;if(!/^[0-9a-f-]{36}$/.test(key))return json({error:'Not found'},404);
  try{
    const row=await db().prepare('SELECT id,owner FROM profiles WHERE photo_key=? OR id IN (SELECT profile_id FROM profile_photos WHERE key=?)').bind(key,key).first<{id:string;owner:string}>();if(!row)return json({error:'Not found'},404);
    if(row.owner!==owner&&(await blocked(owner,row.id)||!await hasView(owner,row.id)))return json({error:'आज की उपलब्ध प्रोफ़ाइल में यह फोटो नहीं है। / Photo is not in your daily profiles.'},403);
    const object=await bucket().get(key);if(!object)return json({error:'Not found'},404);
    return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType??'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch(e){return errorResponse(e);}
}
