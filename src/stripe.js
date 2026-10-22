// Stripe Checkout, TEST MODE ONLY. There is deliberately no live path:
// any key that is not a test key (standard or restricted) is refused before a request is made,
// and a response that says livemode is rejected as a second guard.

// Accepted: standard test secret keys and restricted test keys. Nothing else.
const TEST_PREFIXES = [['sk', 'test', ''].join('_'), ['rk', 'test', ''].join('_')];

/** 'missing' | 'test' | 'refused'. Never returns or logs the key itself. */
export function classifyKey(key) {
  if (!key) return 'missing';
  const prefix = TEST_PREFIXES.find((p) => key.startsWith(p));
  // Suffix: letters, digits and underscores only (what Stripe issues). Anything else,
  // such as spaces or newlines, is refused so a key can never smuggle extra header text.
  return prefix && /^[A-Za-z0-9_]*[A-Za-z0-9][A-Za-z0-9_]*$/.test(key.slice(prefix.length)) ? 'test' : 'refused';
}

export class CheckoutError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function createCheckoutSession({
  secretKey, priceCents, currency, productName, successUrl, cancelUrl, storeUrl, fetchImpl = fetch,
}) {
  if (classifyKey(secretKey) !== 'test') throw new CheckoutError('not_test_key', 'Only Stripe test mode is allowed.');
  const body = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': currency,
    'line_items[0][price_data][unit_amount]': String(priceCents),
    'line_items[0][price_data][product_data][name]': productName,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  if (storeUrl) body.set('metadata[store_url]', storeUrl);

  let res;
  try {
    res = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { authorization: `Bearer ${secretKey}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new CheckoutError('stripe_unreachable', 'Could not reach Stripe.');
  }
  let json = {};
  try {
    json = await res.json();
  } catch { /* handled below */ }
  if (!res.ok) throw new CheckoutError('stripe_error', `Stripe said no (${(json.error && json.error.type) || res.status}).`);
  if (json.livemode !== false) throw new CheckoutError('not_test_mode', 'Stripe did not confirm test mode, so we stopped.');
  if (typeof json.url !== 'string' || !json.url.startsWith('https://checkout.stripe.com/')) {
    throw new CheckoutError('stripe_error', 'Stripe did not return a checkout page.');
  }
  return { url: json.url, livemode: false };
}
