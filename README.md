# Nelcota Leads

An in-house tool that finds local businesses and qualifies them with AI.

1. You enter a niche and a city (e.g. "dentistas" in "Belo Horizonte").
2. The app looks the businesses up in the Google Places API (New).
3. For each business, a queue (Cloudflare Queues) reads its public website, when there is one, and DeepSeek writes a summary, opportunity signals, likely pain points and a 0–100 score with its reasoning. Leads below the minimum score are discarded.
4. You select leads and send: the AI writes an email for each business, you review them, and they go out from your own mailbox, spaced out, up to 30 a day.
5. When a business replies, the AI carries the conversation on its own until there is interest (price, meeting, proposal), then hands it over to you.

> Email is the only automated channel. WhatsApp stays manual: the app prepares the text and the `wa.me` link.

## Stack

TanStack Start (React 19) on Cloudflare Workers · D1 + Drizzle · Cloudflare Queues · Vercel AI SDK + `@ai-sdk/deepseek` · Tailwind v4 + shadcn/ui · TanStack Query/Table · oxlint/oxfmt · Vitest (`@cloudflare/vitest-plugin`) · lefthook · pnpm.

```
src/
  routes/            pages (leads, detail, searches, settings) and /api/leads.csv
  server/            server functions, collection, queue (consumer) and per-lead processing
  db/                Drizzle schema and D1 client
  lib/places/        Google Places (Text Search, daily limit)
  lib/scrape/        website reader (robots.txt, linkedom)
  lib/ai/            prompts, DeepSeek analyzer, cost
  server.ts          Worker entry: fetch (app) + queue (consumer)
drizzle/             SQL migrations (applied by wrangler)
```

## Running locally

Requirements: Node 22+ and pnpm.

```bash
pnpm install
cp .dev.vars.example .dev.vars     # fill in the keys and APP_PASSWORD
pnpm db:migrate:local              # creates the local D1 database
pnpm dev                           # http://localhost:3000
```

The whole app sits behind a login screen with local accounts (email and password, stored in D1 with a PBKDF2 hash). Set `APP_PASSWORD` (8+ characters) in `.dev.vars` and, in production, with `wrangler secret put APP_PASSWORD`: it is the **access code** required to create an account (`/criar-conta`) or reset a password (`/redefinir-senha`), and also the key that signs sessions. The first time, open `/criar-conta` and use that code. To get a local account without going through the screen, run `pnpm account:seed --new --name "Your name" --email you@company.com`: it writes `account.local` (ignored by Git) with a random password and creates the account in the local D1; afterwards, `pnpm account:seed` recreates or updates that account in any fresh local database (`--persist-to` picks another one). A session lasts 30 days; resetting a password signs out that account's other browsers, and changing `APP_PASSWORD` signs out everyone. Wrong attempts lock out for 15 minutes: 10 per address (password or code) and 30 per account from any address, and the screen says how long is left. The access code also has a cap of 100 failures a day across all addresses; it only closes sign-up and password reset, never signing in.

The `GOOGLE_PLACES_API_KEY` and `DEEPSEEK_API_KEY` keys are required: the app does not use mock data. `MAIL_ADDRESS` and `MAIL_PASSWORD` are needed to send emails; test the connection in Configurações (Settings). While any of them is missing, the new search screen warns and blocks the search, and Configurações shows "Caixa não conectada" (mailbox not connected). To fix it, put the variables in `.dev.vars` and restart the app; in production, use `wrangler secret put <NAME>` (see [Deploy](#deploying-to-cloudflare)). The app's error screen has "Copiar detalhes" (copy details), which copies the error's name, message and route for whoever investigates it.

Workflow: Configurações (offer, criteria, email and automatic mode) → Buscar empresas (search businesses), or the automatic daily search → Leads: select and click Disparar e-mail (send email) → review the emails the AI wrote → Disparar (send) → follow along in Conversas (conversations); when the AI stops, the conversation shows up in "Precisa de você" (needs you).

### Variables

| Name                         | Type                   | Description                                                                                  |
| ---------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `GOOGLE_PLACES_API_KEY`      | secret                 | Key with "Places API (New)" enabled                                                          |
| `DEEPSEEK_API_KEY`           | secret                 | Key from platform.deepseek.com                                                               |
| `AI_MODEL_ANALYSIS`          | var (`wrangler.jsonc`) | Model for the analysis and score. Default: `deepseek-flash`                                  |
| `AI_MODEL_MESSAGE`           | var (`wrangler.jsonc`) | Model for the message. Default: `deepseek-v4-pro`                                            |
| `PLACES_DAILY_REQUEST_LIMIT` | var (`wrangler.jsonc`) | Max paid Google requests per day (Brasília time). Default: `50`, up to ~1,000 businesses/day |
| `MAIL_ADDRESS`               | secret                 | Address of the mailbox that sends and receives (e.g. your Hostinger mailbox)                 |
| `MAIL_PASSWORD`              | secret                 | That mailbox's password                                                                      |
| `SMTP_HOST` / `SMTP_PORT`    | var (`wrangler.jsonc`) | Outgoing server, implicit TLS. Default: `smtp.hostinger.com` / `465`                         |
| `IMAP_HOST` / `IMAP_PORT`    | var (`wrangler.jsonc`) | Incoming server, implicit TLS. Default: `imap.hostinger.com` / `993`                         |
| `MAIL_DAILY_LIMIT`           | var (`wrangler.jsonc`) | Max emails per day, replies included. Default: `30`                                          |

DeepSeek has retired the `deepseek-chat` and `deepseek-reasoner` names. `deepseek-v4-flash` is still accepted, but DeepSeek treats it as a legacy name for `deepseek-flash`.

### Scripts

| Script                                        | What it does                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                                    | development server (Worker + local D1 + Queues via Miniflare)           |
| `pnpm build` / `pnpm deploy`                  | build and deploy to Cloudflare                                          |
| `pnpm lint`                                   | `oxlint --type-aware --type-check` (also checks types)                  |
| `pnpm fmt`                                    | `oxfmt`                                                                 |
| `pnpm test`                                   | unit (Node) and integration (Workers runtime with D1) tests             |
| `pnpm test:e2e`                               | end-to-end tests (Playwright) with mocked Google, DeepSeek and email    |
| `pnpm db:generate`                            | generates a migration from `src/db/schema.ts`                           |
| `pnpm db:migrate:local` / `db:migrate:remote` | applies migrations to the local / remote D1                             |
| `pnpm cf-typegen`                             | regenerates `worker-configuration.d.ts` after changing `wrangler.jsonc` |

`lefthook` runs formatting and lint on every commit (it is installed by `pnpm install`).

The E2E tests start the app with `E2E=1 vite dev` on port 3100. In this mode, Google Places, DeepSeek and the mailbox are swapped for in-memory versions, and the D1 database lives separately in `.wrangler/e2e`. Your `.dev.vars` is not used (the test access code is `e2e-password`, and the setup creates the `e2e@nelcota.test` account). To run a second suite next to another, use `E2E_PORT=3105 pnpm test:e2e`. This mode only exists in the development server: the production build includes neither the mocks nor the `/api/e2e` route.

## Deploying to Cloudflare

```bash
pnpm exec wrangler login

# 1. D1 database: copy the printed "database_id" into wrangler.jsonc (d1_databases[0].database_id)
pnpm exec wrangler d1 create nelcota-leads

# 2. Queues (main + dead-letter)
pnpm exec wrangler queues create nelcota-leads-analysis
pnpm exec wrangler queues create nelcota-leads-analysis-dlq

# 3. Migrations on the remote database
pnpm db:migrate:remote

# 4. Secrets (the value is prompted in the terminal; it never goes into the repository)
pnpm exec wrangler secret put GOOGLE_PLACES_API_KEY
pnpm exec wrangler secret put DEEPSEEK_API_KEY
pnpm exec wrangler secret put MAIL_ADDRESS
pnpm exec wrangler secret put MAIL_PASSWORD

# 5. Deploy
pnpm deploy
```

The deploy prints the `*.workers.dev` URL. Protect it with Cloudflare Access before using it (next section), as an extra layer in front of the app's own login.

Plan: Queues is included in Workers Free (10k operations/day, ≈ 3,300 leads/day), but Free caps each invocation at 10 ms of CPU, and parsing the HTML of large sites can go over that. For real use, Workers Paid (US$ 5/month) is recommended.

### Protecting the dashboard with Cloudflare Access

1. In the Cloudflare dashboard, open Zero Trust → Access → Applications → Add an application → Self-hosted.
2. Under Application domain, enter the Worker's domain (`nelcota-leads.<your-account>.workers.dev` or a custom domain attached to the Worker in _Workers → Settings → Domains & Routes_).
3. Create a policy with Action Allow and an Emails rule containing only your email. The login method can be email _One-time PIN_ or Google.
4. Save and open the URL in a private window: the Access login screen should appear.
5. Optional: in _Workers → nelcota-leads → Settings → Domains & Routes_, disable the `workers.dev` URL if you use a custom domain, so no door is left without Access.

Everything sits behind Access: pages, server functions and `/api/leads.csv`. The queue consumer receives no HTTP traffic.

## How it works

- Collection (`src/server/collect.ts`): `places:searchText` with a minimal `X-Goog-FieldMask` and pagination (`nextPageToken`, 20 per page, 60 max). Businesses that are not `OPERATIONAL` are skipped. Phone numbers are normalized to E.164 with `libphonenumber-js`. Each lead is unique by `place_id`: places already seen in earlier searches are neither saved again nor reanalyzed. The search records how many already existed.
- Queue (`src/server/consumer.ts`): one message per lead. A transient failure retries with exponential backoff (30s, 60s). After 3 attempts the error is recorded on the lead and the search moves on. Messages that exhaust the queue's own retries land in the DLQ, which also marks the lead. That is why no search ever gets stuck on "analyzing".
- Idempotency (`src/server/process-lead.ts`): an already analyzed lead is skipped. Only the Reanalisar (reanalyze) button forces a new analysis, which goes into the history (`analyses`) without inflating the search counters.
- Website reader (`src/lib/scrape`): `fetch` with `AbortSignal.timeout`, an identifiable User-Agent (`NelcotaLeadsBot/1.0`), `robots.txt` compliance (RFC 9309) and a 1.5 MB cap. It extracts the title, meta description, text (truncated at 8,000 characters), social links, emails and business phone numbers from the site itself. If the site fails, the lead is marked `unreachable` and continues with Google's data only.
- AI (`src/lib/ai`): `generateText` + `Output.object` with `zod` schemas. V4's _thinking_ mode is off because it costs more with no gain for this task. The prompt says to use only the data provided, forbids inventing contacts, people or facts, and treats the site's text as untrusted (a defense against _prompt injection_). The AI never poses as a customer. Without the offer described in Configurações it writes no messages, since it would have nothing to offer. Each analysis records model, tokens and estimated cost, and the day's spend goes into `api_usage` so the dashboard can show the month's cost.
- Triage (`src/server/process-lead.ts`): new leads scoring below the minimum (30 by default) are discarded by the AI, with the reason recorded. Each lead's email is taken from its website. The AI never discards a lead you have already contacted, and a discarded lead returns to the queue if a new analysis clears the minimum.
- Autopilot (`src/server/autopilot.ts`): a Cron Trigger runs every hour. Once a day, from the chosen time on, it searches each registered niche and city. The first search covers the whole city; the following ones go through neighborhoods suggested by the AI, because Google returns the same top 60 results for the same query. It stops when the daily Google limit runs out.
- Email (`src/lib/mail`): in-house SMTP and IMAP client over the Worker's TCP sockets (`cloudflare:sockets`), with implicit TLS. Plain UTF-8 text messages, its own `Message-ID`, `In-Reply-To`/`References` to keep the conversation in one thread, and `List-Unsubscribe`. Reading uses `BODY.PEEK`, so nothing is marked as read in your mailbox, and it starts from the moment of connection (old mail is not imported).
- Sending (`src/server/mail-flow.ts`): the AI writes a draft per lead; the text goes through a check for tics (an invented job title, "faz sentido", praise for the Google rating) and is rewritten once if any shows up. In the queue, one email goes out every 8 minutes, within the daily limit. Every first contact ends with the unsubscribe line.
- Conversation (`handleInbound`): every 5 minutes the app reads replies and matches each one to its lead by `In-Reply-To` (or by sender). Automatic replies (out of office, bounces) are kept and ignored. "sair" (opt out) unsubscribes immediately and cancels anything queued. In every other case the AI decides: reply (a simple question about the offer), hand over to you with a draft (interest, price, meeting, a question the offer doesn't answer, or if they ask whether it's a bot), or close (not interested). It replies at most 3 times and never invents price, timeline or features.
- Follow-up: with no reply in 3 days, a single short follow-up goes out in the same thread.
- Scheduler (`src/server/tick.ts`): a Cron Trigger every minute sends the next queued email; every 5 minutes it reads replies and queues follow-ups; on the hour it runs the daily search and the automatic sending (if enabled).
- Screens: Visão geral (overview: what needs you, numbers, funnel, activity and the automatic-mode switches), Leads (selection and sending), Conversas (an inbox with each business's thread and the "IA no comando" control, AI in charge).
- Lead list (`src/routes/leads/index.tsx`): leads sit in queues (A contatar, Retornar hoje, Aguardando resposta, Em conversa, Fechados, Descartados: to contact, follow up today, awaiting reply, in conversation, closed, discarded). When you mark a lead as contacted, the app records the date and schedules the follow-up (3 days by default, adjustable). On that day it shows up in "Retornar hoje" and the menu shows how many there are. J and K move between leads and / jumps to search.
- Progress: the dashboard, the list and the open lead poll (3 s) while an analysis is pending.
- Testing locally: the cron doesn't run on its own in `pnpm dev`. Use `curl "http://localhost:3000/cdn-cgi/handler/scheduled"` for one run, the Verificar e-mails (check emails) button in Conversas, and Buscar agora (search now) in Visão geral.
- CSV: `/api/leads.csv` applies the same filters as the screen. It uses `;` and a UTF-8 BOM so it opens directly in Excel set to Portuguese, and neutralizes formulas (protection against _CSV injection_).

## Estimated costs (October 2026)

Google Places, Text Search Enterprise SKU. The phone, website, rating and review fields put the request in this SKU.

- US$ 35 per 1,000 requests, with 1,000 free requests a month.
- One request returns up to 20 results. A 60-result search costs 3 requests ≈ US$ 0.105, or ≈ US$ 0.00175 per lead.
- The free quota covers up to ~20k results a month.

DeepSeek. Peak price per 1M tokens; off-peak costs half.

| Step                             | Model                                           | Typical tokens             | Cost per lead |
| -------------------------------- | ----------------------------------------------- | -------------------------- | ------------- |
| Analysis and score               | `deepseek-flash` (US$ 0.30 input / 1.20 output) | ~3,500 input + ~400 output | ≈ US$ 0.0015  |
| Message (only above the minimum) | `deepseek-v4-pro` (US$ 1.32 / 3.96)             | ~900 input + ~200 output   | ≈ US$ 0.002   |

Total: ≈ US$ 0.003 to 0.005 per lead (Google + AI), or about US$ 0.20 to 0.30 per 60-lead search. The actual AI cost of each analysis shows on the lead page. Prices live in `src/lib/ai/pricing.ts`; update them if DeepSeek changes its rates.

## LGPD and terms of use

- Data collected: only from legal entities and public business contacts, that is, the Google profile and the business's own website. There is no scraping of social networks or personal profiles. Social networks only appear as links published by the site itself.
- Legal basis: legitimate interest (art. 7, IX, and art. 10 of the LGPD, Brazil's data protection law) for a B2B offer related to the business's activity. Keep a record of the reason for each contact (the _notas_ field) and process only what is necessary.
- Opt-out: every first email and every follow-up ends with the unsubscribe line and the `List-Unsubscribe` header. Anyone who replies "sair" is unsubscribed automatically, never receives anything again and leaves every queue.
- Controlled volume: up to 30 emails a day, one every 8 minutes, always personalized and sent from your own mailbox. Don't raise the limit much: cold email in volume ruins the domain's reputation. Transactional services (Cloudflare Email Service, Resend) forbid prospecting and are not used.
- WhatsApp: stays manual, one at a time. Automated WhatsApp messages to contacts who didn't ask for them violate WhatsApp's policies and get the number banned.
- Google Places: the [Google Maps Platform terms](https://cloud.google.com/maps-platform/terms) restrict storing and reusing Places content. `place_id` may be stored indefinitely; the other fields must be treated as a temporary cache (the current policy says up to 30 days) and refreshed or discarded afterwards. Don't resell or republish the data, and keep the Google attribution when displaying it.
- Websites: the reader identifies itself by User-Agent, respects `robots.txt` and reads one page per business.

## Future improvements

- Cloudflare Browser Rendering for sites that only render with JavaScript.
- Cloudflare Workflows to orchestrate collection → reading → analysis with persistent steps.
- A routine that deletes or refreshes Places data older than 30 days (`scheduled` in `src/server.ts`).
- A "regenerate only the message" button and batch reanalysis.
