# Prompt: revisão de robustez do Nelcota Leads (sanitização, async, performance, segurança, lógica e E2E)

> Cole este documento inteiro como prompt para o agente que vai executar a revisão.
> Ele **não** pede funcionalidade nova nem mudança visual. O objetivo é deixar o que já existe correto, seguro, rápido e coberto por testes.
>
> **Idioma:** converse com o usuário em português. **Código, comentários, nomes de testes, mensagens de commit, título e descrição do PR: em inglês.**

---

## 1. Contexto

O Nelcota Leads é um app de prospecção B2B de uso próprio:

1. O usuário informa nicho + cidade; o app busca empresas no **Google Places API (New)** com limite diário (`PLACES_DAILY_REQUEST_LIMIT`).
2. Cada empresa entra numa **Cloudflare Queue**; o consumer lê o site público (respeitando `robots.txt`, via `linkedom`) e a **DeepSeek** (Vercel AI SDK) gera resumo, dores e nota 0–100.
3. O usuário seleciona leads e dispara e-mails: a IA escreve, o usuário revisa, e o app envia via **SMTP sobre TCP sockets do Worker**, espaçados, até `MAIL_DAILY_LIMIT` por dia.
4. Um **cron por minuto** (`src/server/tick.ts`) envia e-mails devidos, lê respostas via **IMAP** a cada 5 minutos e roda buscas automáticas; a IA responde sozinha até haver interesse e então passa a conversa ao usuário. "sair" descadastra para sempre.

**Stack:** TanStack Start 1.168 (React 19) em Cloudflare Workers · D1 + Drizzle · Queues + DLQ · `ai` + `@ai-sdk/deepseek` · Zod 4 · TanStack Query/Table · Tailwind v4 + shadcn/ui · Vitest com `@cloudflare/vitest-plugin` (projetos `unit` e `workers`) · oxlint (type-aware) / oxfmt · lefthook · pnpm.

**Mapa rápido:**

```
src/server.ts                 entry do Worker: fetch, queue, scheduled
src/server/*.ts               server functions (createServerFn), tick, collect, consumer, process-lead, mail-flow, autopilot
src/routes/api/leads[.]csv.ts exportação CSV
src/lib/scrape/               fetch-site, robots, extract
src/lib/mail/                 smtp, imap, wire, mime, parse
src/lib/ai/                   prompts, analyzer, pricing
src/lib/places/               Google Places
src/lib/schemas.ts            schemas Zod compartilhados
src/db/schema.ts              schema Drizzle; drizzle/ tem as migrations
test/                         fakes (analyzer, mailer, places, queue), reset-db, worker de teste
```

Antes de mexer em qualquer coisa, leia `README.md`, `wrangler.jsonc`, `vitest.config.ts`, `src/db/schema.ts`, `src/lib/schemas.ts` e os testes `*.worker.test.ts` existentes para entender as convenções.

---

## 2. Regras de escopo (invioláveis)

1. **Sem funcionalidade nova e sem mudança visual.** O redesign "Apple Pro" é trabalho separado; não toque em estilos, tokens ou layout. Se um conserto exigir mudar UI (ex.: mensagem de erro), mude só o texto/comportamento, mantendo os componentes atuais.
2. **Comportamento observável preservado**, exceto onde ele for o próprio bug. Todo bug consertado ganha um teste que falhava antes.
3. **Nada de dependência nova** sem justificar no PR. A única adição esperada é `@playwright/test` (dev).
4. **Não rode nada contra serviços reais.** Nunca chame Google Places, DeepSeek, SMTP ou IMAP de verdade em testes; use os fakes em `test/` (crie novos no mesmo estilo se faltar). Nunca envie e-mail real.
5. **Não aplique migrations remotas** (`db:migrate:remote`) nem faça `deploy`. Migration nova só se for indispensável (ex.: índice ou constraint), gerada com `pnpm db:generate` e explicada no PR.
6. **Segredos** só em `.dev.vars` / `wrangler secret`. Nunca em código, log, mensagem de erro devolvida ao cliente, commit ou PR.
7. Siga as skills do usuário: `codebase-design` (seams e testabilidade), `vercel-react-best-practices` (React), `playwright-best-practices` (E2E), `better-auth-best-practices` (se a decisão de autenticação da seção 4.1 for Better Auth), `caveman-commit` (commits).

---

## 3. Fluxo de trabalho

1. Parta de `main` atualizada numa branch nova: `fix/hardening-review`. Se a branch do redesign ainda não foi mergeada e houver alterações não commitadas no working tree, **pare e pergunte** ao usuário antes de fazer qualquer coisa: não misture as duas frentes.
2. **Fase de auditoria primeiro, sem editar código.** Percorra as seções 4 a 8 e produza `docs/hardening-findings.md` (em inglês) com uma tabela: `id | area | file:line | severity (critical/high/medium/low) | finding | failure scenario | proposed fix`. Mostre o resumo ao usuário e **espere aprovação** antes de consertar. Itens que mudam comportamento de produto (ex.: autenticação) precisam de decisão explícita dele.
3. Conserte por área, um commit por área (seção 10), cada um com testes. Rode `pnpm lint`, `pnpm fmt:check` e `pnpm test` antes de cada commit; o hook do lefthook também roda. **Nunca use `--no-verify`.**
4. Escreva a suíte E2E (seção 9).
5. Abra o PR (seção 11).

---

## 4. Segurança

### 4.1 Autenticação e autorização (provavelmente o achado mais grave)

- Verifique se existe **qualquer** proteção nas server functions (`createServerFn`) e em `/api/leads.csv`. Até onde se sabe, não existe: depois do deploy, qualquer pessoa com a URL do Worker pode listar leads, exportar o CSV, disparar e-mails da caixa do usuário, ligar o piloto automático e gastar as cotas de Google/DeepSeek.
- **Não implemente sem perguntar.** Apresente ao usuário as opções com prós e contras e uma recomendação:
  - **Cloudflare Access** na frente do Worker + verificação do JWT `Cf-Access-Jwt-Assertion` num middleware global (zero UI nova, recomendado para app de uso próprio);
  - **Better Auth** com e-mail/senha de um único usuário (exige telas de login e migrations);
  - token estático em secret + cookie `HttpOnly; Secure; SameSite=Strict`.
- Seja qual for a escolha: o middleware deve cobrir **todas** as server functions e rotas `/api/*`, e um teste deve iterar sobre elas garantindo `401/403` sem credencial. `fetch` do Worker para assets estáticos pode ficar livre.

### 4.2 CSRF e métodos

- Server functions que mudam estado devem ser `POST`. Confira se alguma `GET` tem efeito colateral.
- Com autenticação por cookie, valide `Origin`/`Sec-Fetch-Site` nas mutações.

### 4.3 SSRF no leitor de sites (`src/lib/scrape/fetch-site.ts`)

- A URL vem do Google Places e do usuário. Hoje há `redirect: "follow"` sem checar o destino. Bloqueie esquemas diferentes de `http/https`, hosts `localhost`, IPs literais privados/loopback/link-local (IPv4 e IPv6, incluindo `0.0.0.0`, `169.254.0.0/16`, `::1`, `fc00::/7`, formas decimais/hex de IP), portas não padrão e credenciais na URL (`user:pass@`).
- Siga redirects **manualmente** (`redirect: "manual"`), validando cada salto, com limite (ex.: 5).
- Mantenha o limite de bytes (`readLimited`) e o timeout; confira que o timeout cobre a leitura do corpo, não só os headers.

### 4.4 Injeção de prompt (sites e e-mails recebidos são conteúdo hostil)

- Texto de site e corpo de resposta de e-mail vão para a IA. Garanta que estão delimitados como dados (não instruções) em `src/lib/ai/prompts.ts`, truncados, e que a saída da IA é validada por schema Zod.
- O auto-responder (`mail-flow.ts`) não pode ser induzido a: enviar para outro destinatário, incluir links/anexos arbitrários, revelar o prompt, prometer preço/condições, ou continuar respondendo depois de "sair". O destinatário e o `In-Reply-To` devem vir do banco, nunca da saída da IA.
- Limite de respostas automáticas por conversa e por dia, para não haver loop com outro robô (auto-reply, "out of office", bounce). Detecte `Auto-Submitted`, `Precedence: bulk/auto_reply`, `X-Autoreply` e `MAILER-DAEMON` e **não responda**.

### 4.5 E-mail (SMTP/IMAP/MIME)

- **Header injection:** qualquer valor de cabeçalho (assunto gerado pela IA, nome da empresa, endereço) deve rejeitar `\r` e `\n` antes de `encodeHeader`. Teste com payloads `"foo\r\nBcc: x@y"`.
- **Dot-stuffing** no corpo SMTP (linha que começa com `.`) e normalização de quebras para CRLF.
- Comandos SMTP/IMAP com valores do usuário (`MAIL FROM`, `RCPT TO`, `LOGIN`, `SEARCH`) devem escapar ou rejeitar caracteres de controle e aspas.
- Endereços de destino validados (Zod `email()` + sem caracteres de controle), deduplicados e conferidos contra a lista de descadastrados **no momento do envio**, não só na preparação.
- O parser de respostas (`postal-mime`) deve ter limite de tamanho e não pode lançar exceção que derrube o tick inteiro.

### 4.6 CSV (`src/lib/csv.ts` + rota)

- **Formula injection:** células começando com `= + - @ \t \r` devem ser neutralizadas (prefixo `'`). Nome de empresa vem do Google e é controlado por terceiros.
- Aspas e quebras de linha escapadas conforme RFC 4180; BOM UTF-8 para o Excel abrir acentos.

### 4.7 XSS e saída

- Procure `dangerouslySetInnerHTML` (há um em `__root.tsx` para o script de tema: confirme que o conteúdo é constante), `href` com dados externos (site da empresa, link `wa.me`): só aceite `http(s):`, nunca `javascript:`; links externos com `rel="noopener noreferrer"`.
- Cabeçalhos de segurança nas respostas HTML: `Content-Security-Policy` compatível com o script de tema (hash ou nonce), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors 'none'`.

### 4.8 Segredos e erros

- Mensagens de erro devolvidas ao cliente não podem conter chave, senha, resposta crua do provedor nem stack. Logue internamente, devolva mensagem genérica em português.
- `testMailConnection` não pode ecoar a senha nem a conversa SMTP completa.

---

## 5. Sanitização e validação de entrada

- **Toda** server function com entrada usa `.validator(schema Zod)`; as que não têm entrada devem continuar sem. Liste as que faltam.
- Schemas com limites explícitos: `max()` em strings (nicho, cidade, notas, rascunho de e-mail, assunto), `max()` em arrays (já existe `max(100)` em alguns; confira todos), `int().min().max()` em números de paginação/limites, enums em vez de `string()` livre para status/ordenação/colunas.
- Ordenação/filtros dinâmicos em `leads-query.ts`: a coluna de `ORDER BY` deve vir de uma whitelist, nunca interpolada. Confira que todo SQL usa Drizzle ou `sql` com parâmetros; procure `sql.raw` e template strings em SQL.
- `trim()` e normalização (NFC) em textos de entrada; telefones via `libphonenumber-js` como já existe; e-mails em minúsculas para comparação.
- Dados que chegam de fora (Google Places, HTML extraído, saída da IA, e-mail recebido) são validados com Zod **na fronteira** antes de gravar no banco. Saída da IA inválida conta como falha da tentativa, não grava lixo.
- Settings (`settings-store.ts`): valores lidos do banco também passam por schema com defaults, para que um registro corrompido não derrube o app.

---

## 6. Async, concorrência e consistência

- **Promessas soltas:** procure chamadas `async` sem `await`, `forEach(async ...)`, `.then` sem tratamento de erro. Ative/confirme as regras do oxlint para promessas não tratadas (`no-floating-promises` ou equivalente type-aware).
- **Ticks sobrepostos:** o cron roda a cada minuto e o tick pode demorar mais que isso (IMAP, SMTP, buscas). Garanta que dois ticks não enviem o mesmo e-mail nem processem a mesma resposta duas vezes. Use reserva atômica no D1 (ex.: `UPDATE ... SET status='sending', claimed_at=? WHERE id=? AND status='queued'` e conferir `changes`), com expiração da reserva para crash no meio.
- **Idempotência do consumer da fila:** mensagens podem ser entregues mais de uma vez. Reprocessar um lead não pode duplicar análise, custo registrado ou contadores. Confira `MAX_ATTEMPTS` versus `max_retries` e o caminho da DLQ (busca sempre termina).
- **Limites diários sob concorrência:** `PLACES_DAILY_REQUEST_LIMIT` e `MAIL_DAILY_LIMIT` devem ser verificados e incrementados de forma atômica (um único `UPDATE ... WHERE count < limit`), não "lê, compara, grava". Dia calculado no fuso de Brasília de forma consistente (`src/lib/today.ts`).
- **Timeouts e cancelamento:** toda chamada externa (Places, DeepSeek, SMTP, IMAP, sites) tem timeout; sockets TCP são fechados em `finally`, mesmo em erro.
- **Isolamento de falhas:** um lead/e-mail/conversa com erro não pode interromper o lote inteiro do tick ou do consumer. Use `Promise.allSettled` ou try/catch por item, com concorrência limitada.
- **`ctx.waitUntil`:** confira que trabalho em background no `fetch` também usa `waitUntil` e não é perdido.
- **React Query:** mutações invalidam as queries certas; sem estado otimista que fique errado após falha; botões de ação (disparar, reanalisar, rodar agora) desabilitados enquanto pendentes para evitar clique duplo, e o servidor também é idempotente.

---

## 7. Performance

- **N+1 no D1:** procure loops com `await db.select` por item (dashboard, conversas, leads). Troque por consultas agregadas, `inArray` ou `db.batch`.
- **Índices:** para cada `WHERE`/`ORDER BY` frequente (status, `next_send_at`, `lead_id`, `search_id`, datas, e-mail), confirme que existe índice no `schema.ts`. Use `EXPLAIN QUERY PLAN` no D1 local para provar.
- **Paginação** na lista de leads e no CSV (streaming ou limite alto explícito) em vez de carregar tudo.
- `getDashboard` faz muita coisa numa só função: meça e consolide consultas, rodando em paralelo as independentes.
- **Cliente:** evite waterfalls nos loaders (dados independentes em paralelo), `staleTime` adequado no React Query, memoização só onde o profiler mostrar necessidade, listas grandes sem re-render inteiro, imports pesados (`papaparse`, `date-fns`) só onde usados. Rode `pnpm build` e compare o tamanho do bundle antes/depois.
- Custo de IA: confira que o texto do site é truncado antes do prompt e que não há chamada de LLM repetida para o mesmo conteúdo.

---

## 8. Revisão de lógica de negócio

Para cada regra abaixo, encontre o código, confirme que está certa e escreva (ou aponte) o teste que a cobre:

- Busca: deduplicação de empresas entre buscas (mesmo `place_id`), leads abaixo da nota mínima descartados, busca termina mesmo com falhas (DLQ).
- Limite diário de Places por dia em Brasília; virada de dia correta (incluindo meia-noite).
- E-mail: espaçamento de 8 minutos entre envios, máximo de `MAIL_DAILY_LIMIT` por dia, nunca enviar para descadastrado, nunca enviar duas vezes o primeiro e-mail ao mesmo lead, um único follow-up após 3 dias sem resposta, e nenhum follow-up se houver resposta.
- Respostas: associadas ao lead certo por `In-Reply-To`/`References` (não só pelo remetente); "sair" (variações de maiúsculas, acento, pontuação, "SAIR.", "quero sair") descadastra para sempre e confirma uma vez; interesse/preço/reunião passa a conversa ao usuário e desliga a IA daquele lead.
- Verificação de frases proibidas reescreve **uma** vez e, se falhar de novo, não envia (ou vai para revisão), sem loop.
- Transições de status do lead (`src/server/lead-status.ts`): mapeie a máquina de estados, liste transições inválidas possíveis e impeça-as no servidor.
- Piloto automático: ligar/desligar respeitado no próximo tick; "rodar agora" não duplica a execução do cron.
- Datas: tudo gravado em UTC e exibido em Brasília; nenhuma comparação de data como string em formato diferente.

---

## 9. Testes

### 9.1 Unitários e de integração (Vitest, já configurado)

- Cada bug consertado: teste que falha antes e passa depois, no projeto certo (`*.test.ts` para lógica pura, `*.worker.test.ts` para o que usa D1/Queues).
- Testes de tabela para sanitização: SSRF (lista de URLs proibidas), header injection, CSV injection, detecção de "sair" e de auto-reply.
- Teste de concorrência: dois `runTick` simultâneos sobre o mesmo D1 não enviam o mesmo e-mail duas vezes (use o `fake-mailer` contando envios).

### 9.2 End-to-end (Playwright, novo)

Use a skill `playwright-best-practices`.

- Adicione `@playwright/test` como devDependency e o script `"test:e2e": "playwright test"`. Config em `playwright.config.ts`, testes em `e2e/`.
- O servidor de teste roda o app real (`vite dev` numa porta própria, ex. 3100, via `webServer`) com um **modo de teste explícito** (ex.: var `E2E_FAKES=1` em `.dev.vars.e2e` ou equivalente) que injeta os fakes de Places, analyzer e mailer já existentes em `test/`. Esse modo **nunca** pode ser ativável em produção: falhe o boot se `E2E_FAKES` estiver ligado fora do ambiente local, e cubra isso com teste.
- Banco D1 local isolado e resetado antes de cada arquivo (reaproveite `test/reset-db.ts` / migrations).
- Se a autenticação da seção 4.1 for implementada, faça login uma vez num `setup` project e reaproveite `storageState`.
- Fluxos mínimos (locators por role/label, sem `waitForTimeout`, sem seletores CSS frágeis):
  1. **Nova busca:** criar busca "dentistas" em "Belo Horizonte" → leads aparecem com nota → leads abaixo da nota mínima não aparecem.
  2. **Filtros e detalhe:** filtrar por status, abrir o painel de um lead, editar nota/status, recarregar e ver persistido.
  3. **Disparo:** selecionar leads → revisar rascunhos gerados → editar um → remover outro → disparar → fake-mailer recebeu exatamente os esperados; disparar de novo não duplica.
  4. **Conversa:** simular resposta recebida (fake IMAP) → aparece em Conversas → IA responde; resposta com interesse → conversa vai para o usuário e IA desliga; resposta "sair" → lead descadastrado e novos disparos para ele bloqueados.
  5. **CSV:** exportar e validar cabeçalho, acentos e neutralização de fórmula num lead com nome `=HYPERLINK(...)`.
  6. **Configurações:** salvar settings inválidos mostra erro; válidos persistem; teste de conexão de e-mail com fake de sucesso e de falha (mensagem sem segredo).
  7. **Segurança na UI:** lead com site `javascript:alert(1)` e nome com `<script>` renderiza como texto e o link não é clicável como script.
  8. **Erros:** falha do analyzer/fake Places mostra estado de erro tratado (sem tela branca) e o restante continua funcionando.
- Adicione verificação de acessibilidade básica (`@axe-core/playwright`) nas telas principais **só se** o usuário aprovar a dependência extra.
- Falhe o teste em qualquer `console.error` não esperado.
- Documente no `README.md` (em português, seguindo o arquivo) como rodar `pnpm test:e2e`.

---

## 10. Commits

Em inglês, Conventional Commits, curtos, via skill `caveman-commit`. Um commit por área, cada um passando em lint, format e testes. Sugestão de sequência:

```
docs: add hardening audit findings
fix(auth): require auth on server functions and api routes
fix(scrape): block private hosts and validate each redirect
fix(mail): reject CRLF in headers and dot-stuff smtp body
fix(mail): skip auto-replies and cap ai replies per thread
fix(csv): neutralize spreadsheet formulas
fix(validation): bound zod schemas and whitelist sort columns
fix(tick): claim due emails atomically to avoid double sends
fix(limits): enforce daily quotas with atomic updates
perf(db): add indexes and remove n+1 queries in dashboard
test(e2e): add playwright suite with faked providers
```

Cada mensagem termina com:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

## 11. Pull request

- Push da branch e PR para `main` via `gh pr create`, **em inglês**.
- Título: `fix: harden input handling, async flows, security and add e2e tests`
- Corpo:

```markdown
## Summary

<2–4 bullets: what was wrong and what changed>

## Findings

<table from docs/hardening-findings.md: id, severity, finding, status (fixed / deferred + reason)>

## Security

<auth decision, SSRF, injection fixes; anything deferred and why>

## Performance

<before/after: query counts, EXPLAIN QUERY PLAN notes, bundle size>

## Tests

- Unit/worker: <count added>, all passing
- E2E: <flows covered>, `pnpm test:e2e`
- Commands run: `pnpm lint`, `pnpm fmt:check`, `pnpm test`, `pnpm test:e2e`, `pnpm build`

## Migrations

<none, or which ones and why; remote apply is NOT done by this PR>

## Breaking changes / follow-ups

<e.g. new secret required for auth, Cloudflare Access setup steps>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- Não habilite auto-merge. Depois de abrir, acompanhe o CI e corrija falhas.

---

## 12. Critérios de pronto

- [ ] `docs/hardening-findings.md` com todos os achados, cada um marcado como corrigido ou adiado com motivo.
- [ ] Nenhuma server function ou rota `/api` acessível sem autenticação (ou decisão explícita do usuário registrada no PR).
- [ ] Testes de tabela para SSRF, header injection, CSV injection, "sair" e auto-reply.
- [ ] Teste provando que ticks concorrentes não duplicam envios.
- [ ] Suíte Playwright com os 8 fluxos, verde localmente, sem `waitForTimeout`.
- [ ] `pnpm lint`, `pnpm fmt:check`, `pnpm test`, `pnpm test:e2e` e `pnpm build` passando.
- [ ] Nenhuma mudança visual, nenhuma funcionalidade nova, nenhum segredo no diff.
- [ ] Commits e PR em inglês; conversa com o usuário em português.
