export const ACCOUNT_ID = '0806706663c74737529a2e2f9de75440';
export const WORKER_NAME = 'managelove';
export const DATABASE_NAME = 'managelove-test-portal';
export const SITE_KEY = '0x4AAAAAAFR5uwPEgcKjcCzJ';

export async function cloudflare(path, { method = 'GET', body, token = process.env.CLOUDFLARE_API_TOKEN } = {}) {
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is missing. Use the repository workflow; never commit a token.');
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    // Never serialize API results or request bodies, which can contain secret values.
    throw new Error(`Cloudflare ${method} ${path} failed (HTTP ${response.status}; codes ${(data.errors ?? []).map(e => e.code).join(',')}).`);
  }
  return data.result;
}

export async function requireFreePlan() {
  const subscriptions = await cloudflare(`/accounts/${ACCOUNT_ID}/subscriptions`);
  const workers = subscriptions.filter(s => /workers/i.test(`${s.product?.name ?? ''} ${s.rate_plan?.id ?? ''}`));
  if (workers.some(s => !/free/i.test(s.rate_plan?.id ?? ''))) {
    throw new Error('Deployment stopped: this account has a paid Workers subscription. Only Workers Free is authorized.');
  }
  console.log('Workers Free confirmed; deployment has no subscription or billing write permission.');
}
