# Blockers

What is still open and what the owner needs to do. Last updated 2026-10-21.

| # | What | Why it is open | What to do |
|---|---|---|---|
| 1 | Not deployed | Deploys need the owner's account and choice. | Follow `docs/hosting.md` (Render, about 10 minutes). Set `PUBLIC_BASE_URL` and a Stripe **test** key there. |
| 2 | Weekly CI run and Dependabot are not active yet | They live on the `chore/self-maintaining` branch. GitHub only runs scheduled jobs and Dependabot from the default branch. | Merge that pull request. |
| 3 | Payments are test mode only | On purpose: the code refuses live keys. | Going live is a deliberate code change plus a live key in the host's settings. Not needed to make the repo public. |
| 4 | No usage counting | The app does not record scans or checkout clicks. | Needed only if running the paid-fix test (see `MONETIZATION.md`). |
| 5 | WooCommerce not tried on a real store | Only synthetic fixtures cover it. | Run `npm run scan -- <a real WooCommerce store>` once and check the result looks right. |
