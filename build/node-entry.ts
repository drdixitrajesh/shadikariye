import worker from './sites-worker';
import { env } from './node-cloudflare';
export { PortalPasswordService } from '../lib/portal-password';
export async function cleanup() {
  const work: Promise<unknown>[] = [];
  worker.scheduled({} as ScheduledController, env, { waitUntil(promise: Promise<unknown>) { work.push(promise); } } as ExecutionContext);
  await Promise.all(work);
}

export default async function fetch(request: Request) {
  const url = new URL(request.url);
  const allowedHosts = (process.env.APP_ALLOWED_HOSTS ?? 'vedik-milan.softinator.org,managelove.com,www.managelove.com').split(',');
  if (url.pathname !== '/api/health' && !allowedHosts.includes(url.hostname)) return new Response('Unknown host', { status: 421 });
  // Traefik sees the tunnel's local HTTP connection and rewrites forwarded
  // protocol. Cloudflare's visitor scheme preserves the browser's HTTPS URL.
  if (process.env.TRUST_CLOUDFLARE_PROXY === '1') {
    try {
      const scheme = JSON.parse(request.headers.get('cf-visitor') ?? '{}').scheme;
      if (scheme === 'https' || scheme === 'http') {
        url.protocol = scheme + ':';
        request = new Request(url, request);
      }
    } catch { /* Ignore malformed visitor metadata. */ }
  }
  // Set this only when the origin is reachable exclusively through its
  // Cloudflare Tunnel. Direct public origin ports must remain unpublished.
  if (process.env.TRUST_CLOUDFLARE_PROXY !== '1') {
    const headers = new Headers(request.headers);
    headers.delete('cf-connecting-ip');
    request = new Request(request, { headers });
  }
  const ctx = {
    props: {},
    waitUntil(promise: Promise<unknown>) { promise.catch(() => console.error('Background task failed')); },
    passThroughOnException() {},
  } as Parameters<typeof worker.fetch>[2];
  const response = await worker.fetch(request, env, ctx);
  const headers = new Headers(response.headers);
  headers.set('X-ManageLove-Origin', 'sudama-node');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
