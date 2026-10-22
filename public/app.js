// Page logic. All store data is inserted with textContent, never innerHTML.
const $ = (id) => document.getElementById(id);
const form = $('scan-form');
const input = $('store-url');
const btn = $('scan-btn');
const statusEl = $('status');
const results = $('results');
let lastStore = '';

const BADGE = { pass: 'Good', warn: 'Could be better', fail: 'Needs fixing' };

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

function render(report) {
  lastStore = report.store;
  $('score-num').textContent = String(report.score);
  $('score-text').textContent = `${report.score} out of 100`;
  const ring = $('score-ring');
  ring.className = `score-ring ${report.grade}`;
  ring.style.setProperty('--pct', String(report.score));
  $('headline').textContent = report.headline;
  const kind = { shopify: 'Shopify store', woocommerce: 'WooCommerce store' }[report.platform] || 'store';
  $('store-line').textContent = `We checked ${report.store} (${kind}) and ${report.productsChecked.length} product page${report.productsChecked.length === 1 ? '' : 's'}.`;

  const list = $('checklist');
  list.replaceChildren();
  const order = { fail: 0, warn: 1, pass: 2 };
  for (const c of [...report.checks].sort((a, b) => order[a.status] - order[b.status])) {
    const li = el('li', `item ${c.status}`);
    li.dataset.check = c.id;
    const h = el('h3');
    h.append(el('span', `badge ${c.status}`, BADGE[c.status]), el('span', '', c.title));
    li.append(h, el('p', 'detail', c.detail));
    const why = el('p', 'why');
    why.append(el('span', 'label', 'Why it matters: '), document.createTextNode(c.why));
    li.append(why);
    if (c.fix) {
      const fix = el('p', 'fix');
      fix.append(el('span', 'label', 'How to fix: '), document.createTextNode(c.fix));
      li.append(fix);
    }
    list.append(li);
  }
  results.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = input.value.trim();
  if (!url) { setStatus('Please type your store address first.', true); input.focus(); return; }
  btn.disabled = true;
  // Clear the previous report, so an error for this store never sits above another store's score.
  results.hidden = true;
  lastStore = '';
  setStatus('Checking your store. This takes about 20 seconds...');
  try {
    const r = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { setStatus(data.message || 'Something went wrong. Please try again.', true); return; }
    setStatus('Done. Here is what we found.');
    render(data);
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    setStatus('We could not reach the checker. Please check your internet and try again.', true);
  } finally {
    btn.disabled = false;
  }
});

async function loadOffer() {
  try {
    const r = await fetch('/api/config');
    const { checkout } = await r.json();
    const dollars = (checkout.priceCents / 100).toLocaleString('en-US', { style: 'currency', currency: checkout.currency.toUpperCase(), maximumFractionDigits: 0 });
    $('offer-price').textContent = dollars;
    if (!checkout.enabled) $('checkout-msg').textContent = checkout.message;
  } catch { /* the button still explains itself when clicked */ }
}

$('checkout-btn').addEventListener('click', async () => {
  const msg = $('checkout-msg');
  const b = $('checkout-btn');
  b.disabled = true;
  msg.classList.remove('error');
  msg.textContent = 'Opening the payment page...';
  try {
    const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ storeUrl: lastStore }) });
    const data = await r.json().catch(() => ({}));
    if (r.ok && typeof data.url === 'string' && data.url.startsWith('https://checkout.stripe.com/')) {
      window.location.assign(data.url);
      return;
    }
    msg.textContent = data.message || 'We could not open the payment page.';
    msg.classList.add('error');
  } catch {
    msg.textContent = 'We could not open the payment page.';
    msg.classList.add('error');
  } finally {
    b.disabled = false;
  }
});

const params = new URLSearchParams(location.search);
if (params.get('paid') === '1') setStatus('Thank you. Your test payment went through (test mode, no real money).');
if (params.get('canceled') === '1') setStatus('No problem, nothing was charged.');
loadOffer();
