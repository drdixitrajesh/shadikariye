// Exercise the built app in Chromium with a local database and intercepted traffic.
// PLAYWRIGHT_MODULE and PLAYWRIGHT_CHANNEL can select the workstation's browser tools.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { createNodePortalRuntime } from './node-portal-runtime.mjs';

const origin = 'https://vedik-milan.softinator.org';
const hostname = new URL(origin).hostname;
const securityOrigin = 'https://challenges.cloudflare.com';
const securityToken = 'fictional-post-ui-token';
const securityWidget = `
  window.turnstile = {
    render(_container, options) { this.options = options; return 'post-ui-fixture'; },
    reset() {},
    execute() { this.options.callback(${JSON.stringify(securityToken)}); },
    remove() { this.options = null; }
  };
`;
const staticRoot = resolve('dist/client');
const contentTypes = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
process.env.APP_ALLOWED_HOSTS = hostname;
const runtime = await createNodePortalRuntime({
  bindings: {
    STANDALONE_MODE: 'test-portal',
    REQUIRE_ACCOUNT_MOBILE: '1',
    PUBLIC_REGISTRATION: '1',
    PORTAL_KEY: 'a'.repeat(64),
    TURNSTILE_SITE_KEY: 'fixture-site',
    TURNSTILE_SECRET_KEY: 'fixture-secret',
  },
  async outboundService(request) {
    assert.equal(request.url, securityOrigin + '/turnstile/v0/siteverify');
    const values = new URLSearchParams(await request.text());
    assert.equal(values.get('response'), securityToken);
    return Response.json({ success: true, hostname, action: 'post', challenge_ts: new Date().toISOString() });
  },
});

async function serveFixture(route) {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin === securityOrigin && url.pathname === '/turnstile/v0/api.js') {
    return route.fulfill({ body: securityWidget, contentType: 'text/javascript' });
  }
  if (url.origin !== origin) return route.abort();
  const file = resolve(staticRoot, '.' + decodeURIComponent(url.pathname));
  const contentType = contentTypes[extname(file)];
  if (file.startsWith(staticRoot + sep) && contentType && existsSync(file)) {
    return route.fulfill({ body: readFileSync(file), contentType });
  }
  const response = await runtime.dispatchFetch(url.href, {
    method: request.method(),
    headers: await request.allHeaders(),
    body: request.postDataBuffer() ?? undefined,
  });
  return route.fulfill({
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: Buffer.from(await response.arrayBuffer()),
  });
}

let browser;
try {
  const db = await runtime.getD1Database();
  for (const migration of readdirSync('drizzle').filter(file => file.endsWith('.sql')).sort()) {
    await db.exec(readFileSync('drizzle/' + migration, 'utf8').replaceAll('--> statement-breakpoint', ''));
  }
  const adminId = randomUUID();
  const adminToken = randomBytes(32).toString('hex');
  const now = Date.now();
  await db.prepare("INSERT INTO portal_accounts(id,username,role,status,test_account,created_at,mobile) VALUES(?,'guest-ui-admin','admin','active',0,?,'+919000000000')").bind(adminId, now).run();
  await db.prepare('INSERT INTO portal_sessions(token_hash,account_id,session_version,mfa_verified,created_at,expires_at) VALUES(?,?,0,1,?,?)').bind(createHash('sha256').update(adminToken).digest('hex'), adminId, now, now + 3600000).run();
  browser = await chromium.launch({
    headless: true,
    args: ['--host-resolver-rules=MAP * ~NOTFOUND'],
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  });
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: 'block' });
    await context.route('**/*', serveFixture);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(origin + '/post');
    const form = page.locator('.simple-post-form');
    const name = 'Fictional Guest UI ' + width;
    const about = 'Fictional biography used only to check submission in the isolated test database.';
    const fields = {
      name,
      birthDate: '1996-04-15',
      mobile: '12345',
      height: '170',
      community: 'Gaur',
      city: 'Indore',
      education: 'Graduate',
      profession: 'Teacher',
      about,
    };
    for (const [field, value] of Object.entries(fields)) {
      await form.locator(`[name="${field}"]`).fill(value);
    }
    await form.getByRole('combobox', { name: 'राज्य / प्रांत', exact: true }).selectOption('Madhya Pradesh');
    await form.getByRole('combobox', { name: 'ज़िला / काउंटी', exact: true }).selectOption('Indore');
    await form.locator('[name="termsAccepted"]').check();
    await form.locator('[name="consent"]').check();

    const send = form.getByRole('button', { name: 'Admin approval के लिए भेजें', exact: true });
    async function submit() {
      const response = page.waitForResponse(result =>
        result.url() === origin + '/api/submissions' && result.request().method() === 'POST'
      );
      await send.click();
      return response;
    }
    const rejected = await submit();
    assert.equal(rejected.status(), 400, await rejected.text());
    await form.getByRole('alert').filter({ hasText: 'संपर्क मोबाइल नंबर' }).waitFor({ state: 'visible' });
    assert.equal(await form.locator('[name="name"]').inputValue(), name);
    assert.equal(await form.locator('[name="about"]').inputValue(), about);
    assert.equal(await form.locator('[name="consent"]').isChecked(), true);
    assert.equal(await page.locator('dialog.privacy-screen[open]').count(), 0);

    await form.locator('[name="mobile"]').fill('900000' + String(width).padStart(4, '0'));
    await send.scrollIntoViewIfNeeded();
    const formScroll = await page.evaluate(() => window.scrollY);
    assert.ok(formScroll > 500, 'submission starts from the bottom of the long form');
    const submitted = await submit();
    assert.equal(submitted.status(), 201);
    const { profileId, memberId, approvalStatus } = await submitted.json();
    assert.equal(approvalStatus, 'pending');
    const receipt = page.locator('.post-success');
    await receipt.waitFor({ state: 'visible' });
    const background = await receipt.evaluate(element => getComputedStyle(element).backgroundColor);
    const rgb = background.match(/\d+/g)?.slice(0, 3).map(Number);
    assert.ok(rgb?.length === 3 && rgb.every(channel => channel >= 230), 'receipt has a light background, got ' + background);
    const heading = receipt.getByRole('heading', { name: 'प्रोफ़ाइल मंज़ूरी के लिए भेज दी गई' });
    await heading.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.activeElement === document.querySelector('.post-success h1'));
    const box = await heading.boundingBox();
    assert.ok(box && box.y >= 0 && box.y + box.height <= 800, 'confirmation heading is in the viewport');
    assert.ok(await page.evaluate(() => window.scrollY) < formScroll, 'the viewport leaves the bottom of the form');
    assert.equal(await page.locator('html[data-privacy-shield="hidden"],dialog.privacy-screen[open]').count(), 0);
    assert.match(await receipt.getByRole('link', { name: 'मेरी प्रोफ़ाइल सँभालें' }).getAttribute('href'), /^\/post\/privacy#[a-f0-9]{64}$/);
    assert.ok((await receipt.innerText()).includes(profileId));
    assert.deepEqual(pageErrors, []);

    const pending = await runtime.dispatchFetch(origin + '/api/admin/members?' + new URLSearchParams({ q: name, pending: '1' }), {
      headers: { Cookie: '__Host-managelove=' + adminToken },
    });
    assert.equal(pending.status, 200);
    const { members } = await pending.json();
    assert.ok(members.some(member => member.id === memberId && member.profile.id === profileId && member.profile.approvalStatus === 'pending'));
    await context.close();
  }
  console.log('PASS: Guest submission error, retry, visible receipt and admin queue on mobile and desktop.');
} finally {
  await browser?.close();
  await runtime.dispose();
}
