# Roadmap

Only what is in **Now** gets built. Every decision below is dated.

## Now

- Docker test environment: `Dockerfile.dev` + `compose.yaml` that run the dev server with reload on save and the project checks inside the container, without installing Node or pnpm on the machine. (2026-11-02)
- Visual identity in the app, PR 1 of the mockup rollout: Urbanist font, blue accent (`#0a62e6` light / `#1a6cf5` dark), the Nelcota PRs tokens (surfaces, radii 20px card / 28px panel, pill buttons) and the sidebar from the mockup. No change in behavior. (2026-11-03, mockup approved by the user: "vamos passá-las pro localhost")

- The whole approved mockup in the app, built locally in `.claude/worktrees/identity` and shown on localhost, then reviewed for logic bugs. Nothing is committed or pushed until the user says so; it is split into one PR per step below before review. Steps that send e-mail or migrate data follow guard rule 7 (flag off by default, local database only, fake recipients). (2026-11-03, the user: "agora passe tudo para o localhost, posteriormente revise minuciosamente")

Icon standard for the whole app: icons inside actions (buttons, action cards, contact shortcuts, add and remove controls) are bare line icons in their tone, with the official WhatsApp and Google Maps marks; icons in card titles and list rows keep the tinted chip. (2026-11-05, chosen by the user over "bare everywhere")

Card action button standard: use `size="sm"` for actions in card headers and table rows (the button standard removed `xs`). Each card in Visão geral has at most one solid blue main action: Abrir agenda, Ver conversas, Ver leads, or Editar meta while no goal is set. Once a goal exists, Editar meta is gray (`variant="outline"`), as is Ajustar in Disparo de hoje. Cancelar and Voltar stay ghost. (2026-11-08, revised after the user chose less visual friction)

Badge standard for the whole app: every status badge is a line icon in the status color followed by neutral text; no pill, no tinted fill, no dot. (2026-11-05, the user rejected the tinted pill "● Caixa não conectada" and chose "ícone de traço + texto" for all badges)

The steps, in this order: (1) Visão geral with the new layout on today's data; (2) record bounces, loss reason and closing data; (3) dispatch control; (4) metrics panel; (5) sales stages, meeting and proposal with the service table; (6) team and "who took the lead". (2026-11-03)

- Agenda calendar, phase 1: Month, Week and Day views on the `/agenda` page, opening on Week, over the meetings and follow-ups the agenda v1 already stores (PR #23). Create a meeting by clicking a free slot and reschedule by dragging. No e-mail. Mockup first, approved by the user before any code; built in its own worktree on top of `feat/nelcota-identity`. (2026-11-05, chosen by the user) One migration added on 2026-11-06: a meeting reason column (fixed list plus "Outro" with free text), so guard rule 7 applies to that step. The rest of the scope is in the 2026-11-06 decision below.
- Agenda reminders, phase 2: in-app reminders for the team only ("começa em 15 min"), no e-mail to the lead. (2026-11-05, chosen by the user)
- Notification center: a bell with an unread count on every page, a panel grouped by category, optional sound. Mockup first, approved by the user before any code. (2026-11-07, asked by the user: "repasse esta opção a um novo chat e vamos criar esta função")
- Sign-in card: no drop shadow, wider card (480px) and larger text on the login, sign-up and password-reset screens, plus a light/dark theme toggle. Applies the "no drop shadows" item below to these screens only. (2026-11-07, asked by the user and approved on localhost)
- Leads page redesign, in the Visão geral language: mockup first, approved by the user before any code; built in `.claude/worktrees/leads-redesign`. Layout and actions, not only visuals; the choices are in the two 2026-11-07 Leads decisions below. No e-mail. No migration, except the unread-reply mark, which is its own step under guard rule 7. (2026-11-07, chosen by the user over six rounds of questions and the canvas review)
- Integrated app shell, like Nelcota PRs: the sidebar and the content share one background (no rounded inset panel around the content), a wider sidebar (256px) with 44px items, the active item in solid blue, the Sistema group and a visible "Recolher menu" button at the bottom (moved here from Next), status badges in the 2026-11-05 standard. Changes every page, no change in behavior. Built in `.claude/worktrees/integrated-shell`. (2026-11-08, canvas approved by the user: "Aprovado", then "Colocar em Now")
- One button standard for the whole app: a single pill design with five roles (primary, secondary, ghost, danger, link), three heights (32 compact, 40 default, 48 sign-in) and one selectable pill (`ChoicePill`) that replaces the seven filter/tab/segmented variants found in the 2026-11-08 audit. Mockup first, approved by the user before any code; built in `.claude/worktrees/button-standard`. Visual only, no change in behavior. The scope is in the 2026-11-08 decision below. (2026-11-08, chosen by the user: "Now + mockup")
- Conversas redesign: the open conversation in the new layout, from the canvas "Nelcota-leads · Conversas (lead aberto)". Chat bubbles (company right, client left), day separators, older messages collapsed, a collapsible lead panel, a reply field that grows as you type, filters as one grid of `ChoicePill`, badges and buttons in the 2026-11-08 standards, no shadows, no tinted fills. Visual and layout only: no new data, no e-mail change, no migration. Built in `.claude/worktrees/conversas-redesign` on top of `style/button-standard`. The scope is in the 2026-11-08 decision below. (2026-11-08, the user: "agora aplique nossas modificações no localhost 3040", then "Sim, mover para Now")
- Numbers that agree across screens (UX audit T1): fix the four contradictions found on 2026-11-09, after a read-only diagnosis tells real bugs from demo data: "Agenda de hoje" lists follow-ups from October next to today's meeting (split overdue from today); the Equipe "Hoje" block says "Sem reunião marcada" while the Agenda has a 10:00 meeting; the Resposta block shows "— responderam / Responderam 0" next to "Todas as 2 respostas chegaram fora da janela"; the Google search quota reads "Limite diário atingido", "restam 50 de 50" and "0 de 50" at the same time (one indicator, "N buscas restantes hoje", old failures carry their date). No migration, no e-mail. Its own branch from `main`. (2026-11-09, chosen by the user from the UX audit) Diagnosis (2026-11-09, read-only): none of the four is a logic bug; each is a correct number under an unclear label or window, plus month-old demo data. Fixes: "1 hoje · 3 atrasados" in Agenda de hoje; the Resposta block says it counts leads first contacted in the period and shows "Ninguém contatado no período" when that is zero; the quota reads the same way everywhere ("0 de 50 requisições usadas hoje") and an old failure shows its date without "amanhã". The Equipe line ("Próxima reunião", excluding discarded leads) belongs to `feat/team-page`, not to this branch.

- Wording and vocabulary (UX audit T5): moved from Next on 2026-11-09 for the one-shot run (see the decision of that date); the scope is the Next text it had: one word per concept across tabs, badges, stepper and metrics (stages Novo, Contatado, Respondeu, Reunião, Proposta, Fechado, Perdido; owner as Responsável / Sem responsável / Assumir / Deixar sem responsável), one e-mail status text ("E-mail não conectado"), no technical terms on screen (model name, cost per call, "requisições", "bounce"), the signature sentence in Conta that contradicts Configurações, the 404 link, one date format and AI cost in R$. Touches many screens, so it goes after the in-flight branches reach `main`. (2026-11-09, chosen by the user from the UX audit; guard rule 4)
- Accessibility and type (UX audit T6): 4.5:1 contrast on sidebar badges and initials avatars, a seven-size type scale with 16px for running text and every input (iOS zoom), 44px touch targets in the leads table and the agenda, a partial state on "select all", a `<nav>` landmark, one icon per function. Goes after the button standard and the integrated shell reach `main`. (2026-11-09, chosen by the user from the UX audit; guard rule 4; moved to Now the same day for the one-shot run)

- Code review packages (2026-11-10, chosen by the user after a read-only review of `main` on null safety, comparisons/NaN, wasted work and bot protection; scope in the 2026-11-10 decision below), one branch and one PR each:
  - P1 Security: a session secret separate from the sign-up access code (falls back to `APP_PASSWORD` until the new secret is set, so nothing changes on deploy), a daily AI call cap, password-reset e-mails counted and capped, Turnstile and edge rate limiting active only when their keys or bindings exist, `noindex`. Sends e-mail, so guard rule 7 applies.
  - P2 Scheduled jobs: inbox reading and the lead queue no longer stop silently without the AI key, the hourly jobs use the scheduled time instead of the run time, IMAP fails loudly without UIDVALIDITY/UIDNEXT. Runs on a schedule, so guard rule 7 applies.
  - P3 Performance: a lean lead list and slower polling, one query instead of one per lead when discarding or closing in bulk, a niche list without the funnel, the bell without a full scan of `emails` and no background polling, shared date formatters, the dashboard in one batch. No e-mail.
  - P4 Numbers on screen: AI cost no longer rounds to US$ 0,00, a pasted "1,500.50" no longer becomes R$ 1,50, "today" follows midnight, service deadline only accepts whole days. The dispatch sheet's "Restam hoje" goes into the T2 branch and the Google page cap into the T1 branch.

## Next

- Admin-only settings: "Limites de uso" (and other system-wide settings) can be changed by any signed-in account today, so whoever has an account can turn the abuse limits off. Needs an admin role or owner check on the settings server functions. (2026-11-10, found by /revisar on P1; the user: "corrija tudo"; guard rule 4)
- Split `src/routes/settings.tsx` (about 880 lines) into one component per section under `src/components/settings/`, no visual change. Its own PR after T4, T5 and P1 reach `main`, since all three touch that file. (2026-11-10, found by /revisar; guard rule 4)
- Sender name per account: lead e-mails signed with the name of the account that sends them (or the lead's owner for automatic ones) instead of one system-wide "Seu nome" in Conta. Changes e-mail sending, so guard rule 7 applies. (2026-11-10, from the user's T5 answer: each partner signs up with the name they choose)
- Agenda, phase 3 (after phases 1 and 2), the four additions the user chose on 2026-11-06 as most useful:
  - Meeting outcome: after the time, the meeting asks for Realizada, Não compareceu or Remarcar; Realizada suggests the lead's next stage. Migration (status column), so guard rule 7 applies.
  - Lead context in the meeting detail: stage, last contact, proposal value and the last notes, read from data the lead already has.
  - Call link: store the Meet/Zoom link on the meeting and show "Entrar na chamada" from 10 minutes before. Migration (link column).
  - Overlap warning: when booking or dragging, warn if that partner already has a meeting at that time. No migration.
    (2026-11-06, chosen by the user; guard rule 4: offers accepted go to Next, not built)
- No drop shadows anywhere in the app: popovers, Select lists, dropdowns, dialogs, sheets and toasts separate by a 1px border and a solid fill only (remove `--shadow-panel` / shadow utilities). The agenda gets this inside its own PR; the rest of the site is this item. (2026-11-06, asked by the user in the agenda canvas)
- Dispatch control on the site: start a run of up to 90 e-mails, pause, resume and cancel it, and see which ones already went out. Sends e-mail, so guard rule 7 applies (flag off by default, dry-run, fake recipients in testing, "Raio de impacto" in the PR). (2026-11-03)
- Record what the app throws away today: bounces as "not delivered", a required loss reason from a fixed list (one click, optional note, AI may suggest), date, value in R$ and service of each closed deal, and the lead's status history. Database migration, so guard rule 7 applies. (2026-11-03)
- Metrics panel in four blocks (sending, replies, business, per niche), built on the data above, AI cost shown as cost per closed deal. Confirmed by the user. (2026-11-03)
- Sales stages and proposal: stages Reunião marcada and Proposta enviada in the lead, a "Montar proposta" form built from the service table (base price plus add-ons plus items the client asks for) and the closing pre-filled from the proposal. Sends e-mail, so guard rule 7 applies. (2026-11-03)
- Service table in Configurações: fixed services with base price and deadline, plus priced add-ons. (2026-11-03)
- Team: the owners' e-mails get access to the panel, all with the same permissions; each lead shows who took it. Inviting sends e-mail, so guard rule 7 applies. (2026-11-03)
- Clickable metrics on the Visão geral: each metric opens Leads filtered to match. Step 1 uses the filters Leads already has ("Responderam", "Interessados"); step 2 adds a date filter so the list matches the chosen period. New navigation, not part of the visual identity PR. (2026-11-04, accepted by the user; guard rule 4)

- Monthly goal on the Visão geral: deals and revenue against a goal the team edits as quality, speed and lead capture grow. Needs the closing date and value from the data step. (2026-11-03, accepted by the user) The pt-BR typing mask and the card fixes are in PR #34 (2026-11-08).
- pt-BR money mask in the other value fields: the closing value of a lead, the client requests in the proposal and the service and add-on prices use the `NumberInput` from PR #34, so "1.500,50" forms while typing, as in "Meta do mês". No migration, no e-mail. (2026-11-08, accepted by the user; guard rule 4)
- Alert for interested leads left without an answer: a single alert on the Visão geral after 1 day without contact ("não podemos perder tempo com clientes"). (2026-11-03, accepted by the user; on 2026-11-07 it became a category of the notification center in Now)
- Nelcota's own agenda, v1: meetings created in the lead, shown on the Visão geral from the start and in their own sidebar item. Built in PR #23 (14-day list, follow-ups, owner filter); the calendar views moved to Now on 2026-11-05. (2026-11-03, accepted by the user)
- Best reply hour: when leads answer, by hour, to tune the 6h–18h window. Where it shows is still to decide. (2026-11-03, accepted by the user)
- Conversas, new functions after the Conversas redesign; each gets its own mockup first:
  - Stage and owner in the side panel: the lead's stage (Novo → Fechado) and who took it (Haniel, Phellipe or Guilherme), read from data the Leads panel already shows. No migration.
  - Meeting in the side panel: an "Agendar reunião" button and the next meeting booked with the lead, from the agenda that already exists. No migration.
  - Undo send: a few seconds to cancel or edit a reply after clicking Enviar, like Gmail. Changes how e-mail is sent, so guard rule 7 applies.
  - Quick AI replies: two or three short replies suggested by the AI above the reply field, reviewed and sent with one click. Spends AI calls per conversation opened; sending stays manual.
    (2026-11-08, chosen by the user; guard rule 4: offers accepted go to Next, not built)
- Conversas code split, no visual change: move the thread's queries, mutations and draft autosave out of `src/routes/conversas.tsx` (about 770 lines) into a `useConversationThread` hook, and the thread into `src/components/conversas/conversation-thread.tsx`, so the page keeps only the list. Its own PR, after the redesign. (2026-11-09, found by /revisar; the user: "corrija")

## Later

- Log contacts made outside e-mail (WhatsApp, phone, meeting) in the lead's history, once the team talks to clients through other channels. (2026-11-03)
- Hook the "Agendar reunião" action into Nelcota's own scheduling tool, once that tool exists. (2026-11-03)
- Show how often each score range really closes, so the score weights can be tuned with data. Needs closed deals recorded first. (2026-11-03)
- Agenda, left out of the full model on 2026-11-05: meeting end time and attendees, events without a lead (team meeting, site delivery, blocked time), work hours, a public booking link for leads with an `.ics` invite, an e-mail reminder to the lead and recurring events. Each needs a migration or sends e-mail, so guard rule 7 applies. (2026-11-05; on 2026-11-06 the outcome and overlap warning moved to Next and the `.ics` feed was dropped)

## Decisions

### 2026-11-10: P1 and P2 ship switched off (guard rule 7)

- **P2:** a late cron runs its scheduled slot (automatic dispatch and daily searches not skipped) only with `SCHEDULED_CATCH_UP=true`. Off by default: a late run skips the hourly steps, as before. Turned on by hand by whoever runs the infrastructure. The other P2 fixes (inbox and lead queue without the AI key, loud IMAP errors) send nothing and stay on.
- **P1:** the password-reset caps and the daily AI cap ship off. Configurações gets a "Limites de uso" switch (off) and three numbers: resets per account per day (3), resets per day in total (20), AI calls per day (500). Stored in new `settings` columns (one migration); replaces `AI_DAILY_REQUEST_LIMIT`. Turnstile, the edge rate limit and `SESSION_SECRET` already only act when configured.
- **Why:** the user accepted the rule 7 notice on the condition that both enter disabled and are turned on manually ("o p2 eu já quero que entre desativado ... p1 adicione uma forma mesmo que seja em configurações ... e também já envie desativado").

### 2026-11-10: partner test skipped for the UX audit PRs

- **Decision:** the test with Haniel, Phellipe and Guilherme on localhost 3040 is skipped before the PRs of T1–T5 and P1–P4 (the user: "pule esta etapa de teste com sócios e vamos para a próxima"). Replaces, for these PRs, "each topic is tested by the user with the partners before its PR opens" in the 2026-11-09 one-shot decision. The other checks stay: lint, test, build, e2e, localhost in both themes.
- **Each PR says so:** "Not verified: usability test with the partners (skipped by decision of 2026-11-10)".
- **Review if:** the superior asks for the partner test before approving; the script stays ready in the session notes.

### 2026-11-10: T5 product answers

- **AI cost:** stays in US dollars on screen ("cote em dólar"); no BRL rate in the app.
- **Owner button:** "Assumir lead" (not "Assumir"), so it never collides with "Assumir conversa", the AI-vs-person control in Conversas.
- **Closed conversation badge:** "Encerrada" splits into "Fechada" (lead closed with a deal) and "Perdida" (lost, discarded or unsubscribed). The "Fechadas e perdidas" filter keeps both.
- **Sender name:** the name in Conta was a sample; each partner's name comes from the account they create. Signing lead e-mails with each person's own account name is a change to sending, so it goes to Next (guard rule 4), not into T5.
- **Why:** the user answered the four open questions from the T5 run.

### 2026-11-10: line icons everywhere, one icon per function

- **Decision:** every icon is a bare line icon (Lucide) in its status color, with no tinted chip, tile or square behind it, in card titles, list rows, actions and badges alike. Overview card titles get an icon. One icon per function across the app. Replaces the 2026-11-05 icon standard's "icons in card titles and list rows keep the tinted chip". Avatars with initials and the brand mark are not icons and stay as they are.
- **Where:** the shared icon components (`IconTile`, `TitleChip`, `CategoryChip`) and the overview cards no topic branch touches go in their own branch `style/line-icons`, so dropping that branch brings the old look back; icons on screens a topic changed (T1, T2, T3, P4) go in that topic's branch.
- **Why:** the user reviewed the "Depois" canvas and asked for icons "to recognize each area without thinking", then rejected the tinted backgrounds ("não gosto destes sombreamentos nos ícones"); implemented on 2026-11-10 with the explicit option to revert if the user does not like it on localhost.
- **Review if:** the user dislikes it on localhost 3040: drop `style/line-icons` and revert the icon commits on the topic branches.

### 2026-11-10: code review packages P1–P4

- **Decision:** the four packages from the 2026-11-10 read-only code review move to Now and run in parallel with the UX one-shot, each in its own worktree from `main`. The Google search stops at the pages the user asked for (20 companies = 1 page), so the quota it spends matches what the dialog promises; this lands in the T1 branch.
- **Not in scope:** approving or merging PRs (guard rule 9). Changing secrets, Turnstile keys or Cloudflare rate-limit and WAF settings is infrastructure: the code reads them when present, and a handoff note lists what to set.
- **Open-PR limit:** with the roadmap, T1–T6 and P1–P4 there are 11 PRs; at most 7 are open at a time, in the queue order, the next one opening as one merges.
- **Why:** the review found no crash in the main flows but a shared secret for sign-up and sessions, scheduled jobs that stop silently, heavy queries polled every 3–30 seconds and numbers the screen promises wrong.

### 2026-11-09: UX audit, one-shot run

- **Decision:** all six topics run now, in the shortest time, without waiting for merges between waves. Wave A: T1, T2 and T3 in parallel, one sub-agent and one worktree from `main` each (files do not overlap). Wave B: T4 and T5 in parallel from `main` plus the three Wave A branches merged locally, each file owned by one sub-agent only (shared files go to T4). Wave C: T6 after T4. T5 and T6 move from Next to Now.
- **Kept:** each topic is tested by the user with the partners before its PR opens; commit, push and PR only on the user's command; checks, localhost in both themes and the diff review stay required; no e-mail is sent while testing.
- **PRs in a queue:** opened in a fixed merge order (roadmap → T1, T2, T3 → T4, T5 → T6); each PR body names the PR it depends on. After each merge the next branches get `main` by merge, never force push.
- **Why:** the user asked for the shortest deadline ("menor prazo possível ... oneshot cauteloso"); the five-day plan spent most of its time waiting for a merge between waves.
- **Review if:** the superior prefers independent PRs over a queue.

### 2026-11-09: UX audit, execution rules and product answers

- **Order:** this roadmap goes first as its own PR (only `docs/ROADMAP.md`), so other sessions follow these decisions. Then consolidate. Check made on 2026-11-09: 15 of the 17 "conflicting" branches were already squash-merged (#23 to #47); the preview sync script lists them because it does not detect squash merges. Only `feat/team-page` (no PR) and `feat/avatar-and-review-fixes` remain, plus leftover commits made after a merge on a few branches (`style/integrated-shell` has one). Consolidation is therefore: list those leftovers for the user (keep in a new branch from `main`, or archive), teach `sync-preview.sh` to skip merged branches, and archive merged worktrees only with the user's OK. Merge, never rebase or force push; skip any worktree another session is working in.
- **Conflicts while consolidating:** the newest dated decision in this roadmap wins; anything not decided here stops and goes to the user.
- **Done for each topic:** `pnpm lint`, `test` and `build` green in the topic's worktree; seen on localhost on the right route, desktop and mobile, with a screenshot and no console error; the diff read by Claude and run through `/revisar`; seen in both themes; and that topic's audit tasks run by the user with Haniel, Phellipe and Guilherme on localhost 3040 (about 15 minutes). The PR opens right after, on the user's command. A later topic starts without waiting for the merge when it touches different files.
- **Replies (T1):** the Resposta block stays cohort based (replies from leads first contacted in the period) and says so; the reply-hours chart is captioned "respostas recebidas".
- **Agenda de hoje (T1):** two groups in the card, "Atrasados (N)" on top with the date in red and "Hoje (N)" below; the title count reads "1 hoje · 3 atrasados".
- **Google quota (T1):** shown as companies left today ("Hoje dá para buscar mais 1.000 empresas"); the dialog shows what the chosen search uses. The word "requisição" leaves the screen.
- **Glossary (T5):** two distinct ends. "Descartado" = not worth prospecting (AI or a person, before negotiating); "Perdido" = negotiated and did not close (with reason). "Encerrar sem negócio" becomes "Marcar como perdido"; the Conversas filter "Encerradas" becomes "Fechadas e perdidas".
- **Dispatch review (T2):** opening the review sheet no longer asks the AI for drafts. It lists the recipients and offers "Escrever N e-mails"; existing drafts are reused at no cost.
- **Enviar without an inbox (T3):** disabled, with "Conecte o e-mail para enviar" next to it; the draft keeps saving.
- **Neutral selection (T4):** no mockup; applied in the button standard branch and judged by the user on localhost 3040.
- **Why:** the user asked to close every gap before sending sub-agents ("vamos questionar ainda mais pra deixar com menor brecha possível").

### 2026-11-09: UX audit, three reversals

- **Decision (selection and blue):** solid blue marks only the main action of a screen. Selected tabs, periods and views (`ChoicePill` on) become neutral: `--fill` background and semibold text. Actions inside Visão geral cards (Abrir agenda, Ver conversas, Ver leads) become link or secondary buttons. Replaces, in the 2026-11-08 button standard, "a selectable pill is a primary button when on", and replaces the 2026-11-08 card action standard's "one solid blue main action per card".
- **Decision (dispatch in Leads):** one button, one job. A "Selecionar prontos" link in the table bar selects the ready leads; the "Disparar (N)" button is enabled only with a selection and opens the review sheet. A lead that is not ready says why on its row (for example "sem e-mail"). Replaces, in the 2026-11-07 Leads canvas review, "Disparar N prontos with nothing selected and Disparar N selecionados with a selection".
- **Decision (Conversas):** the "IA no comando" switch goes. The conversation header states who answers in text ("Você responde esta conversa" / "A IA responde esta conversa") and "Devolver para a IA" is the only control. Replaces the switch kept in the 2026-11-08 Conversas canvas review.
- **Why:** the 2026-11-09 UX audit (Krug + WCAG 2.2) found five solid blue elements on the Visão geral and the active tab in the same blue as the main action; a button that selects on the first click and dispatches on the second in the same place; and a switch shown off while its label says the AI is in charge, next to a button that does the same thing.
- **Discarded:** keeping the 2026-11-07 and 2026-11-08 choices as they were.
- **Where:** the button standard, Leads redesign and Conversas redesign are already merged (#37, #32, #46), so each reversal lands in a new branch from `main`, one per topic (T2 Leads, T3 Conversas, T4 selection).
- **Review if:** with neutral selection, people lose track of which tab or period is active in the test with three users.

### 2026-11-08: Conversas redesign, canvas review

- **Decision:** the open conversation follows the canvas "Nelcota-leads · Conversas (lead aberto)". E-mails show as bubbles: the company (AI or a partner) on the right with a blue 1px border and the "N" mark, the client on the left in a lighter solid surface; no colored fill. Day separators ("Hoje", "Ontem", "Qui, 05/11") and only the time on each bubble. Threads longer than four messages show the last three and "Ver N mensagens anteriores". The lead panel collapses from a button next to "IA no comando". The reply field starts at one line and grows to about 220px. "Devolver para a IA" moves to the "A IA parou" notice. Filters are a two-column grid of `ChoicePill`, "Todas" across the top. A failed send shows a red-bordered bubble with "Tentar de novo" and "Editar". Thin scrollbars in the border color; one focus border on the search field. Text weight 400 (not 300); the subject at 22px.
- **Why:** the user's comments on the canvas, 2026-11-08 ("vícios de I.A", "vícios de navegador", "cores extremamente escuras", "balões de conversa mais visíveis", "aumenta de tamanho conforme você vai escrevendo").
- **Discarded:** editing a sent e-mail like WhatsApp (an e-mail already in the client's inbox cannot change); undo send went to Next.
- **Review if:** the bubble border is not enough to tell company from client in the light theme.

### 2026-11-08: one button standard for the whole app

- **Decision:** every button is a solid pill (no gradient, no shadow) in Urbanist 14px with the same press feedback and focus ring. Roles: primary (solid blue, one per area), secondary (transparent with a 1px border), ghost (no border), danger (secondary with red text) and link (blue text, only to open another page). Heights: 40px default (page bars, filters, tabs), 32px compact (cards, tables, chips in forms), 48px only for the sign-in button; icon-only buttons are round in the same three sizes. A selectable pill is a secondary button when off and a primary button when on, with an optional count; one `ChoicePill` component replaces the Leads tabs, the Visão geral period, the agenda view and month choosers, the meeting kind, the choice chips and the notifications segmented control. No `className` on `Button` that changes height, color, border or radius; this joins the pre-PR checklist.
- **Why:** the 2026-11-08 audit found seven pill implementations (28 to 44px, three different fills), four button heights side by side, icon buttons in five sizes, three "delete" styles, `outline` and `secondary` almost the same, and the Leads tabs with no keyboard focus ring.
- **Discarded:** keeping the gray-track segmented control (iOS style) for the notifications panel, since its white active state is the only one in the app that is not blue; per-screen heights.
- **Review if:** the mockup shows 40px is too tall for the agenda toolbar or the notifications panel.
- Compatible with the 2026-11-08 card action button standard in Now (Editar in solid blue, Cancelar and Voltar as ghost).

### 2026-11-07: Leads page redesign, canvas review and 12 more choices

- **Decision (canvas review, replaces the matching items below):** stage tabs are separate pills, the active one solid blue, split in two groups by spacing only: work in progress (A contatar, Retornar hoje, Aguardando resposta, Em conversa) and archive (Fechados, Descartados, Todos); zero counts hidden. Search, "Meus leads", Filtros and the shortcuts help sit in a bar on top of the table card. No purple anywhere: "em análise" is a grey dashed ring plus text; each stage has its own line-icon color (Novo blue, Contatado teal, Respondeu orange, Reunião green, Proposta yellow, Fechado green, Descartado red). Checkboxes and selects are custom (rounded square, solid blue when checked; selects open a card list). Row actions are always visible, not only on hover. The table never scrolls sideways (fixed column widths, ellipsis). Company logo instead of initials when the site has one. The lead panel keeps the WhatsApp "Primeira mensagem" card for leads without e-mail. The selection bar, the toast and the panel float with the viewport. The primary button reads "Disparar N prontos" with nothing selected and "Disparar N selecionados" with a selection.
- **Decision (12 more):** a "Próximo passo" column that adapts to the tab ("Retorno hoje", "Atrasado 2 dias" in red, "Enviado há 3 dias", "Respondeu há 2h", the next meeting) and is hidden in A contatar; a "Canais" column with icons (e-mail, phone, WhatsApp, site) replaces E-mail and Telefone, full values on hover; the owner's avatar on the row (dashed when free) and a "Meus leads" toggle; each tab opens in its own order (A contatar by score, Retornar hoje overdue first, Aguardando oldest send first, Em conversa unread first then newest reply); overdue follow-ups on top and counted in the tab ("3 · 1 atrasado"); "Disparar" opens a review sheet with each recipient and the start of each e-mail, and nothing is sent without "Enviar N e-mails"; hovering the score shows the two main reasons from the analysis; pages of 25 with "1–25 de 112"; unread replies in bold with a blue envelope and counted in the tab ("2 · 1 nova"); "Novo hoje" next to the hook for leads created in the last 24 hours, plus a "Chegaram hoje" filter; keyboard shortcuts / X E W J K Esc with a "?" list; search matches name, e-mail, phone and address.
- **Data check (2026-11-07):** `contactedAt`, `lastEmailAt`, `followUpOn` (day only, so "Retorno hoje" shows no time), `ownerId`, `createdAt` and `address` already exist. Nothing records whether a reply was read, so the unread mark needs a new column: a migration, guard rule 7, its own PR after the layout.
- **Why:** the user reviewed the canvas comment by comment and asked for two more rounds of questions on what the page still lacks for the daily prospecting work.

### 2026-11-07: Leads page redesign, the 20 choices

- **Decision (structure):** the list stays a table, inside a card like the Visão geral sections. Columns: Empresa (neutral initials avatar, name, opportunity hook such as "Sem site" as the second line), Nota (ring plus number), Etapa (new column, line icon plus text), E-mail, Telefone, Google, row actions. Sorting by clickable column header; the "Maior nota" dropdown goes. Leads still being analysed stay in the list, always last, grey ring, "Analisando" in place of the hook, no row actions. Card footer shows the count only; the J/K hint moves to the lead panel header next to "2 de 4".
- **Decision (actions):** "Selecionar e disparar" is the only blue button at the top and shows the ready count; it replaces the "N leads prontos para disparo" banner. Nova busca and Exportar CSV become secondary. Leads ready to dispatch (e-mail present, analysis done) show a blue paper-plane line icon next to the name with a tooltip. Row actions on hover (always visible on mobile): WhatsApp, Ligar, Escrever e-mail, Mudar etapa. "Mudar etapa" offers only the next stage and Descartar; skipping stages stays in the panel. Discarding is immediate with a 6-second "Desfazer" toast; three or more at once asks for confirmation. Selecting rows shows a floating bar at the bottom: count, Disparar, Mudar etapa, Descartar, Exportar. The whole row opens the panel; the checkbox and the action icons are the exception. Exportar CSV exports what is on screen (tab plus filters), or the selection from the floating bar; file name carries the tab.
- **Decision (filters):** stages stay in the segmented control; Nota, Nicho, Busca, Sem site and Com e-mail move into one "Filtros" button that opens a compact popover, shows "Filtros · N" and lists the active ones as removable chips.
- **Decision (panel and mobile):** the panel's five shortcuts follow the 2026-11-05 icon standard (bare line icons, official WhatsApp and Maps marks); "Novo" and "Livre" become icon plus text. On mobile each lead is one compact row with name, score, stage, WhatsApp and Ligar, no horizontal scroll.
- **Why:** the Leads page still carries the pre-identity layout (colored avatars, tinted pills, loose filter bar, banner) while the Visão geral already follows the new identity; the user asked to rethink the page with quick-access actions and icons.
- **Discarded:** card rows and a Kanban (would be a new feature), stage list on the side, filters sheet, "all stages" in the row menu, confirmation dialog on every discard, export everything always.

### 2026-11-06: dependabot PRs do not count toward the open-PR limit

- **Decision:** guard rule 6 (at most seven open PRs across all repositories) counts only PRs the user or Claude open. Dependabot's automatic dependency PRs do not count.
- **Why:** the user's answer when the agenda calendar PR was ready and nine dependabot PRs were open.

### 2026-11-07: notification center moves to Now

- **Decision:** a notification center (bell with an unread count on every page, a panel grouped by category, optional sound) goes to Now. It absorbs the Next item "Alert for interested leads left without an answer": that alert becomes one category of the center instead of a single card on the Visão geral. A mockup comes before any code; the unread marker is a migration, so guard rule 7 applies to that step.
- **Why:** asked by the user on 2026-11-07 ("repasse esta opção a um novo chat e vamos criar esta função"); today nobody is told when a lead replies, a follow-up falls due or a search finishes. The Leads redesign also marks unread replies in bold, so both read the same unread data.
- **Discarded:** keeping the alert as a single Visão geral card in Next.
- **Answers (2026-11-07, the user):** the bell sits at the top right of the main area on every page; first categories are Respostas, Retornos e atrasados (includes the interested-lead alert), Agenda and Buscas concluídas; sound and the system notification start off and each person turns them on per category (the system notification only when the tab is in the background); each person chooses "only my leads" (default; a lead without owner and finished searches reach all three partners) or "all leads"; clicking a notification opens the lead in the Leads panel (meeting: the Agenda detail; search: the search) and marks it read.
- **Approved (2026-11-07):** after the canvas review (clicking a notification takes you to its origin), the user asked to build it on localhost, review UI/UX and fix what is found ("envie ao nosso localhost e faça uma revisão detalhada de ui e ux"). Built in `.claude/worktrees/notifications-center-948873` behind `NOTIFICATIONS_ENABLED` (off by default), local database only; nothing is pushed until the user says so, and it is split into one PR per step before review.
- **Data (proposal, to confirm with the mockup):** notifications are computed from data the app already stores (inbound e-mails, `leads.followUpOn`, `meetings.startsAt`, `searches`), with no notifications table and no scheduled job. One new column `emails.read_at` marks a reply as read and serves both the bell and the bold unread replies in the Leads redesign. Read marks for the other categories and each person's preferences come in later steps.
- **Revised (2026-11-07, after seeing it on localhost):** "não tem botão de clear, ficou grande demais, a separação por tópico também não me agradou". The panel becomes one list ordered by time, newest first, split only into "Novas" and "Anteriores" (the colored icon tells the type); the category groups go. "Limpar tudo" at the top and an X on each row remove notifications from the panel for that person (not only mark them read). Rows are compact (title and one line of text, no owner line, smaller icon) and the panel shrinks to about 360px wide and 480px high. The categories stay in the preferences (show, sound, system). Canvas updated first; code only after the user approves it. "Limpar tudo" carries a broom line icon (canvas comment). Approved by the user on 2026-11-07 ("mostre no localhost"). Clearing needs one more column (`notification_reads.dismissed_at`), a local migration under guard rule 7 like the rest.

### 2026-11-05: dark theme by default, toggle on the sign-in screens

- **Decision:** the app opens in the dark theme for everyone; light only when the person picks it, and that choice is remembered on the device. The sign-in screens (Entrar, Criar conta, Redefinir senha) get a theme button in the top-right corner, besides the one already in the sidebar and in Conta.
- **Why:** asked by the user while reviewing the login screen ("adicione o botão de modo escuro e deixe padrão também o modo escuro"). Settles the open "dark-first or system theme" question of the visual identity.
- **Discarded:** following the system theme.

### 2026-11-06: agenda canvas review (phase 1 scope)

- **Decision:** phase 1 keeps Month, Week and Day; the List view and its four summary tiles leave the agenda (redundant with Week). Event cards are neutral (solid surface, thin border, gray type icon); no tinted or amber fills. No drop shadows; layers separate by a 1px border. No "now" line on the timeline. The partners are Haniel, Phellipe and Guilherme. Pickers follow the app's Select (outline pill + list with ✓), with search in the lead list. The toolbar keeps one shape in every view, with a date picker (month and year), zoom (five levels) and a back button to the previous view. Meetings at the same time on Week group into one card. The detail shows the time first, with a relative label, plus Remarcar and a back button. New meeting gets a Day field, a reason (fixed list plus "Outro") and an animated checkbox. Clicking an empty day in Month opens New meeting on that day. Day view shows a day summary and one column per partner.
- **Why:** the user's comments on the canvas, 2026-11-06.
- **Discarded:** the List view; color by partner or type; syncing with Google Agenda (the team uses only Nelcota's agenda); the `.ics` feed.
- **Approved:** the user approved the canvas on 2026-11-06 ("Aprovado").
- **Also decided (2026-11-06):** a meeting gets its own assignee ("Quem vai"), so a partner can attend a meeting of another partner's lead; it shares the migration with the reason. Phase 1 ships in two PRs: (1) the calendar views, the toolbar, the detail, booking from the agenda and rescheduling, with no migration; (2) the migration with the reason and the assignee, under guard rule 7.

### 2026-11-05: agenda calendar first, reminders for the team only

- **Decision:** the agenda grows from the v1 in PR #23 with Month, Week and Day views, opening on Week, built on the data it already stores. Reminders stay inside the app for the team. A mockup of phase 1 comes before any code.
- **Why:** the user chose the calendar views as the scope of the full agenda; Week shows the times of three partners side by side; the views need no migration and send nothing.
- **Discarded for now:** events without a lead, availability and overlap warnings, the public booking link, the e-mail reminder to the lead (kept in Later).
- **Still open:** how long a meeting lasts on the Week view while the table has no end time (the mockup proposes a fixed 30 minutes).

### 2026-11-03: fixed service table with add-ons; a team of three owners

- **Decision:** prices come from a fixed service table; the client may ask for more and each extra is added to the base price. The X1 happens by e-mail for now. Meetings will be booked in a scheduling tool Nelcota builds itself. The team is the leader (Haniel) and two partners who also build the websites and talk to clients: no separate roles, everyone does everything, so everyone gets the same permissions and the panel only needs to show who took each lead.
- **Why:** answers from the user to the mockup review of 2026-11-03.
- **Discarded:** a custom quote for every client; roles and permissions per person; a third-party calendar (Google Agenda, Calendly).
- **Also decided (2026-11-03):** every e-mail is signed "Equipe Nelcota". When a lead asks the price, the AI stops and hands the conversation to the team; it does not quote prices while the fixed prices are not defined.
- **Still open:** the real prices of the service table; post-sale, notifications and a monthly report.

### 2026-11-03: Visão geral additions

- **Decision:** add an editable monthly goal, an alert for interested leads without contact for 1 day, Nelcota's own agenda (Visão geral and sidebar) and the best reply hour. No daily summary e-mail to the partners.
- **Why:** answers from the user to the Visão geral review.
- **Discarded:** the daily summary e-mail.
- **Still open:** an alert for the domain's reputation (bounces and unsubscribes); where the best reply hour shows.

### 2026-11-03: the lead score orders the daily dispatch

- **Decision:** the daily run of 90 e-mails goes to the highest-scored leads first. The screens show the score as Alta, Média or Baixa instead of the 0–100 number. The minimum score that discards a lead stays as it is.
- **Why:** the user did not see a use for the score; ordering spends the daily limit on the companies most likely to need a website.
- **Discarded:** removing the score; tuning the weights with closing data (stays in Later).

### 2026-11-03: 90 e-mails a day, business hours only

- **Decision:** the outreach sends 90 e-mails a day, only between 6h and 18h (Brazil time), keeping the current gap of one e-mail every 8 minutes. How the daily limit changes (today `MAIL_DAILY_LIMIT` is 30) is still open: the user will decide.
- **Why:** about 100 contacts a day is the volume the team wants to measure capture against; 90 is what fits the 12-hour window at the current gap, and the user accepted it.
- **Discarded:** 100 a day (would need a 7-minute gap); ramping up in steps (50, 75, 90) to protect the domain's reputation.

### 2026-11-03: loss reasons from a fixed list

- **Decision:** closing a lead without a deal asks for one reason from a fixed list: Preço alto, Já tem fornecedor, Sem interesse agora, Sem orçamento, Não é quem decide, Parou de responder, Fora do perfil, Pediu para não ser contatado, Outro (with a note).
- **Why:** free text cannot be counted or compared by niche.

### 2026-11-02: nelcota.com visual identity replaces the "Apple Pro" direction

- **Decision:** the app's visual direction becomes the identity of https://github.nelcota.com/ (Nelcota PRs): Urbanist instead of Manrope, blue as the accent instead of green, and its tokens for surfaces, lines, radii (card 28px, pill buttons) and semantic colors. Solid surfaces only: no blur, glass or glow.
- **Why:** one visual identity across the Nelcota tools. The palette is already close to "Apple Pro" (same neutrals and system colors), so the change is mostly font, accent and tokens.
- **Discarded:** keeping "Apple Pro" (approved 2026-10-11, `docs/modelo-apple-pro.html`) as is.
- **To settle in the mockup:** dark-first or follow the system theme; which color marks AI (purple today); how much of the "Apple Pro" layout (sidebar, grouped lists, sheets) stays.

### 2026-11-02: Docker for local testing

- **Decision:** add a development-only Docker setup (`Dockerfile.dev`, `compose.yaml`, `.dockerignore`), using `docker compose watch` for reload. Production stays on Cloudflare Workers; there is no production Docker image.
- **Why:** test the app the same way on any machine, following the recipe already used in nelcotaWEBSITE and NELCOTA TEMPLATE.
- **Discarded:** bind mounts for reload (Windows does not forward file events into the container).
