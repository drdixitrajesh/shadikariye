import { expireProfiles } from "../lib/profile-expiry";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import {withPortalUser} from '../lib/portal-context';
import {resolveSession,handlePortal} from '../lib/portal-auth';
import {createPhotoStore} from '../lib/portal-photos';
import {boundedPortalRequest,RequestLimitError} from '../lib/portal-request';
export {PortalPasswordService} from '../lib/portal-password';

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === "/api/health") {
      if (!["GET", "HEAD"].includes(request.method)) {
        return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
      }
      const response = Response.json({
        status: "ok",
        mode: env.STANDALONE_MODE ?? "managed",
        commit: env.DEPLOYMENT_SHA ?? null,
      }, { headers: { "Cache-Control": "no-store" } });
      return request.method === "HEAD" ? new Response(null, response) : response;
    }
    if (env.STANDALONE_MODE === "demo" || env.STANDALONE_MODE === "test-portal") {
      const url = new URL(request.url);
      if (url.hostname === "www.managelove.com" || (url.hostname === "managelove.com" && url.protocol !== "https:")) {
        url.hostname = "managelove.com";
        url.protocol = "https:";
        return Response.redirect(url.href, 308);
      }
      if (env.STANDALONE_MODE==='test-portal'&&["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].includes(url.pathname))return Response.redirect(url.origin+'/login',303);
      if (["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].includes(url.pathname)) {
        return new Response('<!doctype html><html lang="hi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>सदस्य सेवाएं | Vaidik Milan</title><body><main><h1>सदस्य सेवाएं अभी उपलब्ध नहीं हैं</h1><p>Sign-in and member features are not available yet. You can browse fictional demo profiles.</p><a href="/">वेबसाइट पर जाएं / Browse the website</a></main></body></html>', {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
      const headers = new Headers(request.headers);
      for (const name of [...headers.keys()]) {
        if (name.startsWith("oai-authenticated-user-")) headers.delete(name);
      }
      request = new Request(request, { headers });
    }
    if(env.DB && (env.BUCKET||env.STANDALONE_MODE==='test-portal')){
      try{await expireProfiles(env.DB,env.STANDALONE_MODE==='test-portal'?createPhotoStore(env.DB):env.BUCKET!);}
      catch{console.error('Profile expiry sweep failed.');return Response.json({error:'Service temporarily unavailable. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});}
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    let user=null;
    if(env.STANDALONE_MODE==='test-portal'){
      try{request=await boundedPortalRequest(request);user=await resolveSession(request);}
      catch(error){return Response.json({error:error instanceof RequestLimitError?'Request is too large. Photos must be at most 256 KiB.':'Free service temporarily unavailable or quota reached.'},{status:error instanceof RequestLimitError?413:503,headers:{'Cache-Control':'no-store'}});}
    }
    return withPortalUser(user,async()=>{
      const portal=await handlePortal(request);if(portal)return portal;
      if(env.STANDALONE_MODE==='test-portal'&&new URL(request.url).pathname==='/api/otp')return Response.json({error:'Paid SMS is disabled. Invitation-only fictional test accounts use password authentication.'},{status:403,headers:{'Cache-Control':'no-store'}});
      const response=await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
      if(env.STANDALONE_MODE==='test-portal'){
        const headers=new Headers(response.headers);headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');headers.set('Cache-Control','private, no-store');headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains');
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }
      return response;
    });
  },
  async scheduled(_event:ScheduledController,env:Cloudflare.Env,ctx:ExecutionContext){if(env.STANDALONE_MODE==='test-portal'&&env.DB)ctx.waitUntil((async()=>{await expireProfiles(env.DB!,createPhotoStore(env.DB!));await env.DB!.batch([env.DB!.prepare('DELETE FROM portal_sessions WHERE expires_at<?').bind(Date.now()),env.DB!.prepare('DELETE FROM portal_throttle WHERE window<?').bind(Math.floor(Date.now()/900000)-2),env.DB!.prepare('DELETE FROM portal_activations WHERE expires_at<?').bind(Date.now()-86400000)]);})());},
};
