# Build notes

How the first version was checked and reviewed (October 2026). Kept for the record; not needed to run the tool.

## Real-store check (live, 2026-10-20)

Run by hand with the CLI. Both stores loaded, all 13 checks ran, 10 requests each.

| Store | Platform | Score | Notes |
|---|---|---|---|
| www.allbirds.com | Shopify | 98 | 1 of 3 product pages had a short description |
| kith.com | Shopify | 100 | everything passed |

Grade: A for "the scanner runs against real Shopify stores" (seen live). No real WooCommerce store was scanned; the WooCommerce path is grade B (proven by tests with synthetic fixtures only).

## Stripe test-mode proof

Done on 2026-10-20 with `node scripts/stripe-proof.js` (one session, not paid). It went through the real server path, `POST /api/checkout`, using a restricted Stripe test key from the local settings file.

| Field | Result |
|---|---|
| HTTP status from our server | 200 |
| Checkout page host | checkout.stripe.com |
| livemode | false |
| amount_total / currency | 29900 / usd ($299) |
| status / payment_status | open / unpaid |

Grade A (seen live against the Stripe test API). No key or session id is recorded here.

## Review

Five rounds of adversarial review by Codex (a different AI model) on the full diff. Rounds 1 to 4 found 13 real issues (server crash on a malformed address, crash on a cut-off gzip answer, four ways a hostile store could freeze the server, scan not cancelled on timeout, an unreadable robots.txt scored as a pass (two variants), a request-budget race, a bad gzip answer holding its connection open, and two text-decoding edge cases). All were fixed with a regression test each. Round 5 verdict: PASS for crash, freeze, SSRF and Stripe-guard scope.

## What you can learn from this

1. **Check the address at connect time, not before.** Looking up a name, checking it, and then connecting lets a tricky DNS server swap the answer in between. Passing our own `lookup` to Node's request means the exact IP we connect to is the one we checked. See `src/safe-fetch.js:95`.
2. **IPv6 hides IPv4 inside it.** `::ffff:127.0.0.1`, NAT64 and 6to4 addresses all wrap an IPv4 address, so a block list that only knows IPv4 ranges can be bypassed. See `src/safe-fetch.js:46`.
3. **Firewalls look at how you connect, not just who you say you are.** Real Shopify stores answered our first version with 429 "too many requests" while `curl` got in. The difference was that Node's plain HTTPS client did not offer ALPN; one option fixed it. See `src/safe-fetch.js:136`.
4. **robots.txt has real rules, and robots.txt is hostile input.** The most specific group wins, then the longest matching path, and Allow wins a tie (`src/robots.js:71`). Turning `*` into a regular expression let a crafted file freeze the server for 20 seconds, so the matcher splits on `*` and uses `indexOf`, with no backtracking (`src/robots.js:52`).
5. **Two locks on the money door.** The Stripe code refuses non-test keys before calling Stripe, and also refuses any answer that is not test mode. See `src/stripe.js:5` and `src/stripe.js:51`.
6. **You may not need Playwright.** Chrome speaks the DevTools Protocol over a WebSocket, and Node 22 has WebSocket built in, so a short driver can type, click, resize to a phone and take screenshots. See `tests/helpers/cdp.js:79`.
