import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {DEMO_PROFILES,type Profile} from '@/lib/matrimony';
import {isPortal,sameOrigin} from './portal-auth';
import {createPhotoStore,type PhotoStore,PhotoQuotaError,PhotoValidationError} from './portal-photos';
import {approvalStatus} from './profile-approval';
export function db():D1Database{if(!env.DB)throw new Error('Profile storage unavailable');return env.DB;}
export function bucket():PhotoStore{if(isPortal())return createPhotoStore(db());if(!env.BUCKET)throw new Error('Photo storage unavailable');return env.BUCKET as unknown as PhotoStore;}
export async function identity(){return(await getChatGPTUser())?.userId??null;}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function errorResponse(e:unknown){if(e instanceof PhotoQuotaError||e instanceof PhotoValidationError)return json({error:e.message},e.status);console.error('Matrimony storage failure; private input omitted.');return json({error:'Free service temporarily unavailable or quota reached. Please try again later. / निःशुल्क सेवा अभी उपलब्ध नहीं है या सीमा पूरी हो गई है। बाद में कोशिश करें।'},503);}
export function validOrigin(r:Request){if(isPortal())return sameOrigin(r);const o=r.headers.get('origin');return !o||o===new URL(r.url).origin;}
export function fromRow(r:{id:string;data:string;photo_key:string|null;published_at?:number;expires_at?:number}):Profile{const d=JSON.parse(r.data);return{approvalStatus:approvalStatus(r.data),reviewToken:d.reviewToken??'',reviewReason:d.reviewReason??'',publicListing:d.publicListing===true,id:r.id,publishedAt:r.published_at,expiresAt:r.expires_at,name:d.name,email:d.email??'',age:d.age,gender:d.gender,community:d.community,gotra:d.gotra,city:d.city,education:d.education,profession:d.profession,height:d.height,maritalStatus:d.maritalStatus,about:d.about,managedBy:d.managedBy,language:d.language,referenceCount:d.referenceCount??0,demo:false,testAccount:d.testAccount===true,portrait:d.testAccount===true?d.portrait??null:null,photoKey:r.photo_key};}
export async function findProfile(id:string):Promise<Profile|null>{const demo=DEMO_PROFILES.find(p=>p.id===id);if(demo)return demo;const r=await db().prepare('SELECT id,data,photo_key FROM profiles WHERE id=?').bind(id).first<{id:string;data:string;photo_key:string|null}>();return r&&approvalStatus(r.data)==='approved'?fromRow(r):null;}
