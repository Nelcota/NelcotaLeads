# Roadmap

Only what is in **Now** gets built. Every decision below is dated.

## Now

- Docker test environment: `Dockerfile.dev` + `compose.yaml` that run the dev server with reload on save and the project checks inside the container, without installing Node or pnpm on the machine. (2026-11-02)
- Visual identity in the app, PR 1 of the mockup rollout: Urbanist font, blue accent (`#0a62e6` light / `#1a6cf5` dark), the Nelcota PRs tokens (surfaces, radii 20px card / 28px panel, pill buttons) and the sidebar from the mockup. No change in behavior. (2026-11-03, mockup approved by the user: "vamos passá-las pro localhost")

- The whole approved mockup in the app, built locally in `.claude/worktrees/identity` and shown on localhost, then reviewed for logic bugs. Nothing is committed or pushed until the user says so; it is split into one PR per step below before review. Steps that send e-mail or migrate data follow guard rule 7 (flag off by default, local database only, fake recipients). (2026-11-03, the user: "agora passe tudo para o localhost, posteriormente revise minuciosamente")

Icon standard for the whole app: icons inside actions (buttons, action cards, contact shortcuts, add and remove controls) are bare line icons in their tone, with the official WhatsApp and Google Maps marks; icons in card titles and list rows keep the tinted chip. (2026-11-05, chosen by the user over "bare everywhere")

Badge standard for the whole app: every status badge is a line icon in the status color followed by neutral text; no pill, no tinted fill, no dot. (2026-11-05, the user rejected the tinted pill "● Caixa não conectada" and chose "ícone de traço + texto" for all badges)

The steps, in this order: (1) Visão geral with the new layout on today's data; (2) record bounces, loss reason and closing data; (3) dispatch control; (4) metrics panel; (5) sales stages, meeting and proposal with the service table; (6) team and "who took the lead". (2026-11-03)

- Agenda calendar, phase 1: Month, Week and Day views on the `/agenda` page, opening on Week, over the meetings and follow-ups the agenda v1 already stores (PR #23). Create a meeting by clicking a free slot and reschedule by dragging. No e-mail. Mockup first, approved by the user before any code; built in its own worktree on top of `feat/nelcota-identity`. (2026-11-05, chosen by the user) One migration added on 2026-11-06: a meeting reason column (fixed list plus "Outro" with free text), so guard rule 7 applies to that step. The rest of the scope is in the 2026-11-06 decision below.
- Agenda reminders, phase 2: in-app reminders for the team only ("começa em 15 min"), no e-mail to the lead. (2026-11-05, chosen by the user)
- Sign-in card: no drop shadow, wider card (480px) and larger text on the login, sign-up and password-reset screens, plus a light/dark theme toggle. Applies the "no drop shadows" item below to these screens only. (2026-11-07, asked by the user and approved on localhost)
- Notification center: a bell with an unread count on every page, a panel grouped by category, optional sound. Mockup first, approved by the user before any code. (2026-11-07, asked by the user: "repasse esta opção a um novo chat e vamos criar esta função")

## Next

- Agenda, phase 3 (after phases 1 and 2), the four additions the user chose on 2026-11-06 as most useful:
  - Meeting outcome: after the time, the meeting asks for Realizada, Não compareceu or Remarcar; Realizada suggests the lead's next stage. Migration (status column), so guard rule 7 applies.
  - Lead context in the meeting detail: stage, last contact, proposal value and the last notes, read from data the lead already has.
  - Call link: store the Meet/Zoom link on the meeting and show "Entrar na chamada" from 10 minutes before. Migration (link column).
  - Overlap warning: when booking or dragging, warn if that partner already has a meeting at that time. No migration.
    (2026-11-06, chosen by the user; guard rule 4: offers accepted go to Next, not built)
- Visible "Recolher menu" button at the bottom of the desktop sidebar, so it collapses to icons only. The sidebar already supports icon mode (`collapsible="icon"`, Ctrl+B, hover rail), but desktop has no visible button for it. This changes every page, so it is its own PR, not part of the agenda. (2026-11-06, asked by the user in the agenda canvas)
- No drop shadows anywhere in the app: popovers, Select lists, dropdowns, dialogs, sheets and toasts separate by a 1px border and a solid fill only (remove `--shadow-panel` / shadow utilities). The agenda gets this inside its own PR; the rest of the site is this item. (2026-11-06, asked by the user in the agenda canvas)
- Dispatch control on the site: start a run of up to 90 e-mails, pause, resume and cancel it, and see which ones already went out. Sends e-mail, so guard rule 7 applies (flag off by default, dry-run, fake recipients in testing, "Raio de impacto" in the PR). (2026-11-03)
- Record what the app throws away today: bounces as "not delivered", a required loss reason from a fixed list (one click, optional note, AI may suggest), date, value in R$ and service of each closed deal, and the lead's status history. Database migration, so guard rule 7 applies. (2026-11-03)
- Metrics panel in four blocks (sending, replies, business, per niche), built on the data above, AI cost shown as cost per closed deal. Confirmed by the user. (2026-11-03)
- Sales stages and proposal: stages Reunião marcada and Proposta enviada in the lead, a "Montar proposta" form built from the service table (base price plus add-ons plus items the client asks for) and the closing pre-filled from the proposal. Sends e-mail, so guard rule 7 applies. (2026-11-03)
- Service table in Configurações: fixed services with base price and deadline, plus priced add-ons. (2026-11-03)
- Team: the owners' e-mails get access to the panel, all with the same permissions; each lead shows who took it. Inviting sends e-mail, so guard rule 7 applies. (2026-11-03)
- Clickable metrics on the Visão geral: each metric opens Leads filtered to match. Step 1 uses the filters Leads already has ("Responderam", "Interessados"); step 2 adds a date filter so the list matches the chosen period. New navigation, not part of the visual identity PR. (2026-11-04, accepted by the user; guard rule 4)

- Monthly goal on the Visão geral: deals and revenue against a goal the team edits as quality, speed and lead capture grow. Needs the closing date and value from the data step. (2026-11-03, accepted by the user)
- Alert for interested leads left without an answer: a single alert on the Visão geral after 1 day without contact ("não podemos perder tempo com clientes"). (2026-11-03, accepted by the user; on 2026-11-07 it became a category of the notification center in Now)
- Nelcota's own agenda, v1: meetings created in the lead, shown on the Visão geral from the start and in their own sidebar item. Built in PR #23 (14-day list, follow-ups, owner filter); the calendar views moved to Now on 2026-11-05. (2026-11-03, accepted by the user)
- Best reply hour: when leads answer, by hour, to tune the 6h–18h window. Where it shows is still to decide. (2026-11-03, accepted by the user)

## Later

- Log contacts made outside e-mail (WhatsApp, phone, meeting) in the lead's history, once the team talks to clients through other channels. (2026-11-03)
- Hook the "Agendar reunião" action into Nelcota's own scheduling tool, once that tool exists. (2026-11-03)
- Show how often each score range really closes, so the score weights can be tuned with data. Needs closed deals recorded first. (2026-11-03)
- Agenda, left out of the full model on 2026-11-05: meeting end time and attendees, events without a lead (team meeting, site delivery, blocked time), work hours, a public booking link for leads with an `.ics` invite, an e-mail reminder to the lead and recurring events. Each needs a migration or sends e-mail, so guard rule 7 applies. (2026-11-05; on 2026-11-06 the outcome and overlap warning moved to Next and the `.ics` feed was dropped)

## Decisions

### 2026-11-07: notification center moves to Now

- **Decision:** a notification center (bell with an unread count on every page, a panel grouped by category, optional sound) goes to Now. It absorbs the Next item "Alert for interested leads left without an answer": that alert becomes one category of the center instead of a single card on the Visão geral. A mockup comes before any code; the unread marker is a migration, so guard rule 7 applies to that step.
- **Why:** asked by the user on 2026-11-07 ("repasse esta opção a um novo chat e vamos criar esta função"); today nobody is told when a lead replies, a follow-up falls due or a search finishes. The Leads redesign also marks unread replies in bold, so both read the same unread data.
- **Discarded:** keeping the alert as a single Visão geral card in Next.
- **Answers (2026-11-07, the user):** the bell sits at the top right of the main area on every page; first categories are Respostas, Retornos e atrasados (includes the interested-lead alert), Agenda and Buscas concluídas; sound and the system notification start off and each person turns them on per category (the system notification only when the tab is in the background); each person chooses "only my leads" (default; a lead without owner and finished searches reach all three partners) or "all leads"; clicking a notification opens the lead in the Leads panel (meeting: the Agenda detail; search: the search) and marks it read.
- **Approved (2026-11-07):** after the canvas review (clicking a notification takes you to its origin), the user asked to build it on localhost, review UI/UX and fix what is found ("envie ao nosso localhost e faça uma revisão detalhada de ui e ux"). Built in `.claude/worktrees/notifications-center-948873` behind `NOTIFICATIONS_ENABLED` (off by default), local database only; nothing is pushed until the user says so, and it is split into one PR per step before review.
- **Data (proposal, to confirm with the mockup):** notifications are computed from data the app already stores (inbound e-mails, `leads.followUpOn`, `meetings.startsAt`, `searches`), with no notifications table and no scheduled job. One new column `emails.read_at` marks a reply as read and serves both the bell and the bold unread replies in the Leads redesign. Read marks for the other categories and each person's preferences come in later steps.

### 2026-11-06: dependabot PRs do not count toward the open-PR limit

- **Decision:** guard rule 6 (at most seven open PRs across all repositories) counts only PRs the user or Claude open. Dependabot's automatic dependency PRs do not count.
- **Why:** the user's answer when the agenda calendar PR was ready and nine dependabot PRs were open.

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
