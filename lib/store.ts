import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {DEMO_PROFILES,type Profile} from '@/lib/matrimony';
export function db():D1Database{if(!env.DB)throw new Error('Profile storage unavailable');return env.DB;}
export function bucket():R2Bucket{if(!env.BUCKET)throw new Error('Photo storage unavailable');return env.BUCKET;}
export async function identity(){return(await getChatGPTUser())?.userId??null;}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function errorResponse(e:unknown){console.error('Matrimony storage failure',e);return json({error:'Service temporarily unavailable. Please try again. / सेवा अभी उपलब्ध नहीं है। दोबारा कोशिश करें।'},503);}
export function validOrigin(r:Request){const o=r.headers.get('origin');return !o||o===new URL(r.url).origin;}
export function fromRow(r:{id:string;data:string;photo_key:string|null;published_at?:number;expires_at?:number}):Profile{const d=JSON.parse(r.data);return{id:r.id,publishedAt:r.published_at,expiresAt:r.expires_at,name:d.name,email:d.email??'',age:d.age,gender:d.gender,community:d.community,gotra:d.gotra,city:d.city,education:d.education,profession:d.profession,height:d.height,maritalStatus:d.maritalStatus,about:d.about,managedBy:d.managedBy,language:d.language,referenceCount:d.referenceCount??0,demo:false,portrait:null,photoKey:r.photo_key};}
export async function findProfile(id:string):Promise<Profile|null>{const demo=DEMO_PROFILES.find(p=>p.id===id);if(demo)return demo;const r=await db().prepare('SELECT id,data,photo_key FROM profiles WHERE id=?').bind(id).first<{id:string;data:string;photo_key:string|null}>();return r?fromRow(r):null;}
