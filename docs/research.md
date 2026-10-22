# Research and sources


What AI shopping tools read today (checked 2026-10-20):

| Topic | What we learned | Source |
|---|---|---|
| OpenAI product feed | ChatGPT shopping takes a merchant product feed. Required fields include `item_id`, `title`, `description`, `url`, `brand`, `image_url`, `price` (like `79.99 USD`), `availability` (`in_stock`, `out_of_stock`, `pre_order`, `backorder`, `unknown`); `gtin` is optional but must have a valid check digit. Onboarding is through an application, limited to approved partners. | [Products feed spec](https://developers.openai.com/commerce/specs/file-upload/products), [Commerce docs index](https://developers.openai.com/commerce/specs) |
| Agentic Commerce Protocol | The protocol behind checkout inside ChatGPT: ChatGPT acts for the shopper, the merchant keeps processing orders and payments. Stripe is the first implementation of its delegated payment spec. | [OpenAI commerce docs (full text)](https://developers.openai.com/commerce/llms-full.txt), [agenticcommerce.dev](https://agenticcommerce.dev) |
| OpenAI bots | OAI-SearchBot decides ChatGPT search visibility; GPTBot is for training; ChatGPT-User fetches pages when a user asks. Each is controlled separately in robots.txt. | [Overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots) |
| Perplexity bots | PerplexityBot powers Perplexity search results (not training). Perplexity-User is user-triggered and generally ignores robots.txt. | [Perplexity crawlers](https://docs.perplexity.ai/guides/bots) |
| Anthropic bots | ClaudeBot (training), Claude-SearchBot (search quality), Claude-User (user requests). All honor robots.txt. | [Anthropic support article](https://support.claude.com/en/articles/8896518) |
| Google-Extended | A robots.txt token for Gemini training and Gemini grounding. Does not affect Google Search. Google's page does not say whether it affects AI Mode, so this tool treats Googlebot as the bot for AI Mode and Google-Extended as a training-style choice. | [Google common crawlers](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) |
| llms.txt | A proposal (Jeremy Howard, 2024) for a Markdown file at the site root that gives AI tools a short overview and links. Optional and still early. | [llmstxt.org](https://llmstxt.org/) |

What this tool does **not** check (yet): whether the store has actually applied to OpenAI's merchant program, Google Merchant Center status, or prices shown only by JavaScript.

