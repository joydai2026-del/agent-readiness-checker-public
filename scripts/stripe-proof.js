// Usage: node scripts/stripe-proof.js   (creates ONE test-mode session; does not pay)
// One test-mode Checkout Session through the real server path. Prints no key, no session id.
import { loadConfig } from '../src/config.js';
import { createServer } from '../src/server.js';
const config = loadConfig({ ...process.env, PORT: '0' });
console.log('key status:', config.stripe.keyStatus);
if (config.stripe.keyStatus !== 'test') process.exit(0);
const server = createServer({ config });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const r = await fetch(`${base}/api/checkout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ storeUrl: 'www.allbirds.com' }) });
const j = await r.json();
console.log('http status:', r.status, 'mode:', j.mode, 'error:', j.error || 'none');
if (j.url) {
  const u = new URL(j.url);
  console.log('checkout host:', u.host);
  const id = (u.pathname.match(/cs_test_[A-Za-z0-9]+/) || [])[0];
  if (id) {
    const s = await (await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}`, { headers: { authorization: `Bearer ${config.stripe.key}` } })).json();
    console.log('livemode:', s.livemode, 'amount_total:', s.amount_total, 'currency:', s.currency, 'status:', s.status, 'payment_status:', s.payment_status);
  }
}
server.close();
