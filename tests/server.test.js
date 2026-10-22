import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config.js';
import net from 'node:net';
import { listen } from './helpers/fake-store.js';

const FAKE_TEST_KEY = ['sk', 'test', 'FAKEunitTEST000'].join('_');
const FAKE_LIVE_KEY = ['sk', 'live', 'FAKEunitLIVE000'].join('_');

async function start(env = {}, deps = {}) {
  const config = loadConfig(env, { envFiles: [] });
  const server = createServer({ config, ...deps });
  const base = await listen(server);
  return { base, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) };
}
const post = (url, body, raw) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) });

test('serves the page with security headers', async () => {
  const s = await start();
  try {
    const r = await fetch(`${s.base}/`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(await r.text(), /Check my store/);
    assert.equal((await fetch(`${s.base}/../package.json`)).status, 404);
    assert.equal((await fetch(`${s.base}/llms.txt`)).status, 200);
  } finally { await s.close(); }
});

test('POST /api/scan validates input', async () => {
  const s = await start();
  try {
    assert.equal((await post(`${s.base}/api/scan`, {})).status, 400);
    assert.equal((await post(`${s.base}/api/scan`, null, '{bad')).status, 400);
    assert.equal((await post(`${s.base}/api/scan`, { url: 'ftp://x.example' })).status, 400);
    assert.equal((await post(`${s.base}/api/scan`, { url: 'x'.repeat(20_000) })).status, 413);
    assert.equal((await fetch(`${s.base}/api/scan`)).status, 405);
  } finally { await s.close(); }
});

test('POST /api/scan refuses private targets with a friendly message', async () => {
  const s = await start();
  try {
    for (const url of ['http://127.0.0.1/', 'localhost', 'http://169.254.169.254/']) {
      const r = await post(`${s.base}/api/scan`, { url });
      assert.equal(r.status, 400, url);
      assert.match((await r.json()).message, /not a public website/);
    }
  } finally { await s.close(); }
});

test('rate limit per minute is enforced and configurable', async () => {
  const s = await start({ SCANS_PER_MINUTE_PER_IP: '2' }, { scan: async () => ({ score: 1 }) });
  try {
    assert.equal((await post(`${s.base}/api/scan`, { url: 'a.example' })).status, 200);
    assert.equal((await post(`${s.base}/api/scan`, { url: 'a.example' })).status, 200);
    assert.equal((await post(`${s.base}/api/scan`, { url: 'a.example' })).status, 429);
  } finally { await s.close(); }
});

test('total time limit: friendly 504, the scan is told to stop, and its slot stays taken until it ends', async () => {
  let signal;
  const scan = (url, opts) => { signal = opts.signal; return new Promise((r) => setTimeout(r, 6500)); };
  const s = await start({ SCAN_TOTAL_TIMEOUT_MS: '5000', MAX_CONCURRENT_SCANS: '1' }, { scan });
  try {
    const r = await post(`${s.base}/api/scan`, { url: 'a.example' });
    assert.equal(r.status, 504);
    assert.equal(signal.aborted, true);
    assert.equal((await post(`${s.base}/api/scan`, { url: 'a.example' })).status, 503, 'still busy while the old scan winds down');
    await new Promise((r2) => setTimeout(r2, 1700));
    assert.notEqual((await post(`${s.base}/api/scan`, { url: 'a.example' })).status, 503, 'slot freed after it ended');
  } finally { await s.close(); }
});

test('a malformed request line gets 400 and the server keeps running', async () => {
  const s = await start();
  try {
    const { port } = new URL(s.base);
    const raw = await new Promise((resolve, reject) => {
      const sock = net.connect(Number(port), '127.0.0.1', () => sock.write('GET //[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
      let buf = '';
      sock.on('data', (c) => { buf += c; });
      sock.on('end', () => resolve(buf));
      sock.on('error', reject);
    });
    assert.match(raw, /^HTTP\/1\.1 400/);
    assert.equal((await fetch(`${s.base}/api/health`)).status, 200);
  } finally { await s.close(); }
});

test('a live key with a stale "test" status still never reaches Stripe', async () => {
  let called = false;
  const config = loadConfig({}, { envFiles: [] });
  config.stripe = { key: FAKE_LIVE_KEY, keyStatus: 'test' };
  const server = createServer({ config, stripeFetch: async () => { called = true; } });
  const base = await listen(server);
  try {
    const r = await post(`${base}/api/checkout`, {});
    assert.equal(r.status, 502);
    assert.equal(called, false);
  } finally { await new Promise((r) => { server.closeAllConnections?.(); server.close(r); }); }
});

test('checkout with no key says test mode is not configured', async () => {
  const s = await start();
  try {
    const cfg = await (await fetch(`${s.base}/api/config`)).json();
    assert.equal(cfg.checkout.enabled, false);
    assert.equal(cfg.checkout.priceCents, 29900);
    const r = await post(`${s.base}/api/checkout`, {});
    assert.equal(r.status, 503);
    const j = await r.json();
    assert.equal(j.error, 'test_mode_not_configured');
    assert.match(j.message, /test mode not configured/);
  } finally { await s.close(); }
});

test('checkout with a live key is refused and never calls Stripe', async () => {
  let called = false;
  const s = await start({ STRIPE_SECRET_KEY: FAKE_LIVE_KEY }, { stripeFetch: async () => { called = true; } });
  try {
    const r = await post(`${s.base}/api/checkout`, {});
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error, 'refused_key');
    const cfg = await (await fetch(`${s.base}/api/config`)).json();
    assert.ok(!JSON.stringify(cfg).includes('live_'), 'key never echoed');
    assert.equal(called, false);
  } finally { await s.close(); }
});

test('checkout with a test key returns the Stripe page URL only', async () => {
  const stripeFetch = async () => new Response(JSON.stringify({ id: 'cs_test_fake', url: 'https://checkout.stripe.com/c/pay/cs_test_fake', livemode: false, client_secret: 'hidden' }), { status: 200 });
  const s = await start({ STRIPE_SECRET_KEY: FAKE_TEST_KEY, PUBLIC_BASE_URL: 'http://localhost:3000' }, { stripeFetch });
  try {
    const r = await post(`${s.base}/api/checkout`, { storeUrl: 'shop.example' });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { url: 'https://checkout.stripe.com/c/pay/cs_test_fake', mode: 'test' });
  } finally { await s.close(); }
});

test('behind a hosting proxy (TRUST_PROXY_HOPS=1) the rate limit is per visitor, and a faked header cannot dodge it', async () => {
  const s = await start({ SCANS_PER_MINUTE_PER_IP: '1', TRUST_PROXY_HOPS: '1' }, { scan: async () => ({ score: 1 }) });
  const as = (xff) => fetch(`${s.base}/api/scan`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': xff }, body: '{"url":"a.example"}' });
  try {
    assert.equal((await as('203.0.113.1')).status, 200);
    assert.equal((await as('203.0.113.2')).status, 200, 'a different visitor has its own budget');
    // A visitor who puts their own fake address first is still keyed on the address the proxy appended.
    assert.equal((await as('198.51.100.9, 203.0.113.1')).status, 429);
  } finally { await s.close(); }
});

test('without TRUST_PROXY_HOPS the forwarded header is ignored', async () => {
  const s = await start({ SCANS_PER_MINUTE_PER_IP: '1' }, { scan: async () => ({ score: 1 }) });
  const as = (xff) => fetch(`${s.base}/api/scan`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': xff }, body: '{"url":"a.example"}' });
  try {
    assert.equal((await as('203.0.113.1')).status, 200);
    assert.equal((await as('203.0.113.2')).status, 429);
  } finally { await s.close(); }
});
