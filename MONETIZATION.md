# Monetization: honest assessment

## The original idea

A free scan, then a $299 "we fix it for you" service paid through Stripe. Judged a failure if fewer than 3 paid fixes happen in 7 days.

## Who would buy

Small Shopify or WooCommerce store owners who have heard that ChatGPT and other assistants now recommend products. Bigger stores have agencies or in-house developers and do not need a $299 fix. Smaller stores are the buyers, but they are hard to reach and price-sensitive.

## How they would find it with no outreach

Mostly they would not. With no ads, no posts, and no outreach, a new site gets close to zero visitors in its first week. Search engines take weeks to index a new page. There is no marketplace listing (for example the Shopify App Store) and no audience pointed at it. So in a 7-day test with no outreach, the honest expected result is 0 paid fixes, and that result would say nothing about whether the offer is good.

## Is $299 right

Plausible but unproven. Many fixes the scan finds are a few settings (robots.txt lines, theme structured data, vendor and barcode fields), which an agency would bill at one to three hours. $299 is in that range. Some fixes, such as theme structured data, may need theme code work and take longer, so a fixed price carries risk. A cheaper first offer (for example $99 for robots.txt, llms.txt and the top 3 issues) would be easier to say yes to while learning.

## Recommendation: both

| Part | What | Why |
|---|---|---|
| Open source the scanner (MIT) | Make the repo public | It shows Rowan's work (a careful, tested, security-reviewed tool) and is a lead magnet: developers and agencies can find it on GitHub. The scanner itself is easy to copy, so keeping it closed protects little. |
| Sell the fix | Keep the paid fix offer on a hosted copy, Stripe test mode until Rowan chooses to go live | The service (doing the fix) is the product, not the code. |

## What a 7-day test needs to be measurable

1. **Hosted and reachable**: deployed at a public address (see `docs/hosting.md`).
2. **Traffic on purpose**: at least one channel that puts it in front of store owners, for example a post in a Shopify merchant community, a Show HN, or a small ad budget. Without this, the test only measures silence.
3. **Counting**: a count of scans run and fix buttons clicked (the app does not record this today), plus Stripe's own count of completed checkouts.
4. **Live payments**: a real (not test-mode) Stripe key, which needs a deliberate code change, because this code only accepts test keys.
5. **A fair bar**: judge on the funnel (visitors to scans to checkout clicks to payments), not only on "3 paid in 7 days". For example: 100+ scans and 0 checkout clicks says the offer is wrong; 5 scans says the traffic is wrong.
