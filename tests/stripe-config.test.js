import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyKey, createCheckoutSession } from '../src/stripe.js';
import { loadConfig, parseEnvFile } from '../src/config.js';

// Keys are assembled at runtime so no key-shaped string sits in the source.
const FAKE_TEST_KEY = ['sk', 'test', 'FAKEunitTEST000'].join('_');
const FAKE_LIVE_KEY = ['sk', 'live', 'FAKEunitLIVE000'].join('_');
const FAKE_RESTRICTED = ['rk', 'live', 'FAKE000'].join('_');

test('restricted test keys are accepted; every other shape is refused', () => {
  const k = (...parts) => parts.join('_');
  assert.equal(classifyKey(k('rk', 'test', 'FAKErestricted000')), 'test');
  assert.equal(classifyKey(k('rk', 'test', 'abc', 'DEF')), 'test');
  assert.equal(classifyKey(k('sk', 'test', 'abc', 'DEF')), 'test');
  for (const bad of [
    k('rk', 'live', 'FAKE000'), k('sk', 'live', 'FAKE000'), k('pk', 'test', 'FAKE000'), k('pk', 'live', 'FAKE000'),
    ' ' + k('sk', 'test', 'FAKE000'), k('sk', 'test', 'FAKE000') + ' ', '\t' + k('rk', 'test', 'FAKE000'), k('rk', 'test', 'FAKE000') + '\n',
    k('sk', 'test', ''), 'SK_TEST_FAKE000', k('xsk', 'test', 'FAKE'), k('rk', 'test', 'FA-KE'), k('sk', 'test', '', ''), '   ',
  ]) assert.equal(classifyKey(bad), 'refused', JSON.stringify(bad));
  assert.equal(classifyKey(''), 'missing');
});

test('only Stripe test keys are accepted', () => {
  assert.equal(classifyKey(''), 'missing');
  assert.equal(classifyKey(undefined), 'missing');
  assert.equal(classifyKey(FAKE_TEST_KEY), 'test');
  assert.equal(classifyKey(FAKE_LIVE_KEY), 'refused');
  assert.equal(classifyKey(FAKE_RESTRICTED), 'refused');
  assert.equal(classifyKey(FAKE_TEST_KEY + ' extra'), 'refused');
});

test('a live key never reaches Stripe', async () => {
  let called = false;
  await assert.rejects(createCheckoutSession({ secretKey: FAKE_LIVE_KEY, priceCents: 29900, currency: 'usd', productName: 'x', successUrl: 'http://l/', cancelUrl: 'http://l/', fetchImpl: async () => { called = true; } }), (e) => e.code === 'not_test_key');
  assert.equal(called, false);
});

test('test key creates a $299 session with the right form fields', async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/cs_test_fake', livemode: false }), { status: 200 });
  };
  const s = await createCheckoutSession({ secretKey: FAKE_TEST_KEY, priceCents: 29900, currency: 'usd', productName: 'Fix', successUrl: 'http://l/?paid=1', cancelUrl: 'http://l/?canceled=1', storeUrl: 'https://s.example', fetchImpl });
  assert.equal(s.url, 'https://checkout.stripe.com/c/pay/cs_test_fake');
  assert.equal(seen.url, 'https://api.stripe.com/v1/checkout/sessions');
  const form = new URLSearchParams(seen.init.body);
  assert.equal(form.get('mode'), 'payment');
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '29900');
  assert.equal(form.get('metadata[store_url]'), 'https://s.example');
  assert.equal(seen.init.headers.authorization, `Bearer ${FAKE_TEST_KEY}`);
});

test('a response claiming livemode is rejected (second guard)', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ url: 'https://checkout.stripe.com/x', livemode: true }), { status: 200 });
  await assert.rejects(createCheckoutSession({ secretKey: FAKE_TEST_KEY, priceCents: 1, currency: 'usd', productName: 'x', successUrl: 'a', cancelUrl: 'b', fetchImpl }), (e) => e.code === 'not_test_mode');
});

test('Stripe errors do not leak the key in the message', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: { type: 'invalid_request_error' } }), { status: 401 });
  await assert.rejects(createCheckoutSession({ secretKey: FAKE_TEST_KEY, priceCents: 1, currency: 'usd', productName: 'x', successUrl: 'a', cancelUrl: 'b', fetchImpl }), (e) => !e.message.includes(FAKE_TEST_KEY));
});

test('env file parsing and load order (process env wins over files)', () => {
  assert.deepEqual(parseEnvFile('# c\nA=1\nexport B="two"\nC=\'3\'\nbad line\n'), { A: '1', B: 'two', C: '3' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-'));
  const f = path.join(dir, 'env');
  fs.writeFileSync(f, `STRIPE_SECRET_KEY=${FAKE_TEST_KEY}\nPORT=4321\n`);
  try {
    const c = loadConfig({}, { envFiles: [f] });
    assert.equal(c.stripe.keyStatus, 'test');
    assert.equal(c.port, 4321);
    const c2 = loadConfig({ STRIPE_SECRET_KEY: FAKE_LIVE_KEY }, { envFiles: [f] });
    assert.equal(c2.stripe.keyStatus, 'refused');
    assert.equal(loadConfig({}, { envFiles: [] }).stripe.keyStatus, 'missing');
    assert.throws(() => loadConfig({ SCAN_MAX_PRODUCT_PAGES: '999' }, { envFiles: [] }), /SCAN_MAX_PRODUCT_PAGES/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a response with no livemode field is rejected too', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ url: 'https://checkout.stripe.com/x' }), { status: 200 });
  await assert.rejects(createCheckoutSession({ secretKey: FAKE_TEST_KEY, priceCents: 1, currency: 'usd', productName: 'x', successUrl: 'a', cancelUrl: 'b', fetchImpl }), (e) => e.code === 'not_test_mode');
});
