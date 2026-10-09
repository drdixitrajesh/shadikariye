import {AsyncLocalStorage} from 'node:async_hooks';
export type PortalUser={id:string;username:string;role:'admin'|'member';testAccount:boolean;mfa:boolean;sessionHash:string;mfaEnrolled:boolean;sessionVersion:number};
const context=new AsyncLocalStorage<PortalUser|null>();
export function portalUser(){return context.getStore()??null;}
export function withPortalUser<T>(user:PortalUser|null,work:()=>T):T{return context.run(user,work);}
