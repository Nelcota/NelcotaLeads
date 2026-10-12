# Base comum dos prompts de UX (leia antes de qualquer sprint)

> Este arquivo não se executa sozinho. Cada `sprint-N-*.md` manda lê-lo primeiro. As regras daqui valem para todos os sprints, e o arquivo do sprint só acrescenta escopo.
>
> **Idioma:** converse com o usuário em português. **Código, comentários, nomes de testes, commits, título e descrição do PR: em inglês.** Textos da interface: em português, no tom do app (curto, sem jargão).

---

## 1. Contexto

O Nelcota Leads é um app de prospecção B2B **de uso próprio, com um único usuário**:

1. Ele busca empresas no Google Places.
2. A IA (DeepSeek) analisa cada empresa e dá uma nota.
3. A IA escreve o primeiro e-mail, o usuário revisa e o app envia pela caixa dele (SMTP/IMAP).
4. A IA conversa com quem responde até haver interesse e então passa a conversa para o usuário ("Precisa de você").

**Stack:** TanStack Start (React 19) em Cloudflare Workers · D1 + Drizzle · Queues · cron por minuto (`src/server/tick.ts`) · Tailwind v4 + shadcn/ui + componentes próprios em `src/components/apple-ui.tsx` · TanStack Query · sonner · Zod 4 · Vitest (projetos `unit` e `workers`) · Playwright (`e2e/`, com Google, IA e e-mail simulados) · oxlint/oxfmt · lefthook · pnpm.

A fonte de verdade dos itens é **[`docs/guideline-ux-lacunas.md`](../guideline-ux-lacunas.md)**. Cada item tem um ID (T1, N3, C2…), com o local no código e a solução esperada. Leia o guideline inteiro antes de começar, e também:

- `README.md`
- `src/db/schema.ts`
- `src/server/lead-status.ts`
- `src/server/mail.ts`
- `src/server/mail-flow.ts`
- `src/components/apple-ui.tsx`
- `src/components/app-shell.tsx`
- `e2e/fixtures.ts`

Os números de linha do guideline são de 12/10/2026 e podem ter mudado. **Confirme no código antes de editar.**

---

## 2. Regras de escopo (invioláveis)

1. **Só os IDs do seu sprint.** Se encontrar outra lacuna, anote em "Follow-ups" no PR. Não corrija nada fora do escopo.
2. **Design aprovado: "Apple Pro", com superfícies sólidas.**
   - Não use `backdrop-blur`, vidro, brilho seguindo o mouse, manchas de cor ou gradiente de fundo.
   - Use os tokens e componentes existentes (`grouped`, `grouped-row`, `Badge` com tons, `IconTile`, `EmptyState`, `Tooltip`, `Sheet`, `DropdownMenu`).
   - Fonte Manrope, peso 600 só para ênfase, nunca 700 ou mais.
   - A cor semântica vai também no texto: roxo = IA, laranja = precisa de você, verde = sucesso, vermelho = erro/descartar, azul = links/seleção.
3. **As 10 regras de implementação do guideline (seção 0) valem como critério de aceite.** As principais:
   - Desfazer em vez de confirmar.
   - A ação fica no próprio objeto.
   - No máximo um botão primário por área.
   - Botão desabilitado explica o motivo.
   - Nada se perde em silêncio.
4. **Sem dependência nova** sem pedir ao usuário, com o nome do pacote, o motivo e o tamanho. Componentes shadcn que só usam o pacote `radix-ui` já instalado (ex.: `AlertDialog`, `Popover`, que ainda não existem em `src/components/ui/`) **não** contam como dependência nova. Gere com `pnpm dlx shadcn@4.21.4 add <nome>` e ajuste ao visual do app, como foi feito com os outros.
5. **Migrations:** só quando o sprint pedir. Gere com `pnpm db:generate` e aplique só localmente (`pnpm db:migrate:local`). **Nunca** rode `db:migrate:remote` nem `deploy`.
6. **Nada contra serviços reais.** Testes e verificação usam os simuladores (`E2E=1`, `test/fake-*`, `e2e/fakes/*`). Nunca envie e-mail de verdade.
7. **Segurança preservada:**
   - Toda server function nova tem `.validator(...)` com Zod e limites (`max()`).
   - Ações que mudam estado usam `POST`.
   - Mensagens de erro ao cliente não vazam texto cru de provedor.
   - Destinatários de e-mail sempre vêm do banco.
   - Toda rota pública nova entra em `PUBLIC_PATHS` (`src/server/auth.ts`) só se for realmente pública.
8. **Acessibilidade:**
   - Todo botão só com ícone tem `aria-label` e `Tooltip`.
   - Atalhos de teclado não disparam com foco em campo de texto.
   - Respeite `prefers-reduced-motion`.
   - Alvo de toque mínimo de 32 px.
9. Siga as skills do usuário:
   - `apple-design` (interface e movimento)
   - `vercel-react-best-practices` (React)
   - `codebase-design` (server functions e helpers novos com interface pequena e testável)
   - `playwright-best-practices` (E2E)
   - `caveman-commit` (commits)

---

## 3. Fluxo de trabalho

1. **Pré-condição:** `git status` limpo e `main` atualizada. Se houver alterações não commitadas, ou se o sprint anterior ainda não estiver mergeado, **pare e pergunte** ao usuário.
2. Crie a branch indicada no sprint a partir da `main`.
3. **Plano primeiro, sem editar código.** Para cada ID:
   - confirme no código se a lacuna ainda existe;
   - liste os arquivos que vai tocar;
   - aponte riscos (ex.: envio duplicado).

   Mostre o plano ao usuário. Se o sprint tiver "Decisões do usuário", **pergunte agora** e espere as respostas.

4. Implemente um ID ou um grupo pequeno de IDs por commit. Cada commit passa em `pnpm lint`, `pnpm fmt:check` e `pnpm test`. **Nunca use `--no-verify`.**
5. **Testes:**
   - Toda mudança de servidor ganha um teste em `*.worker.test.ts`.
   - Lógica pura ganha teste em `*.test.ts`.
   - Cada sprint estende os specs E2E indicados nele.
   - Sem `waitForTimeout`; use locators por role ou label.
6. **Verificação visual** (com `preview_start` no dev server e `E2E=1` quando precisar de dados):
   - Abra cada tela alterada no **claro e no escuro**, em **375 px e desktop**.
   - Provoque um erro: rede off ou um fake de falha de `e2e/fakes/faults.ts`.
   - Confirme que nenhum texto digitado se perde ao trocar de tela.
   - Guarde capturas para o PR.
7. Ao final, rode `pnpm lint`, `pnpm fmt:check`, `pnpm test`, `pnpm test:e2e` e `pnpm build`.
8. Atualize o guideline marcando `[x]` nos IDs entregues.
9. Abra o PR para `main` com `gh pr create`, **em inglês**, no formato da seção 5. Não habilite auto-merge.

---

## 4. Commits

Conventional Commits em inglês, curtos, via `caveman-commit`. Cada mensagem termina com:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

## 5. Corpo do PR

```markdown
## Summary

<2–4 bullets: which gaps were closed and how the user notices it>

## Items

| ID  | Gap | Change | Status                   |
| --- | --- | ------ | ------------------------ |
| T1  | ... | ...    | done / deferred (reason) |

## Screenshots

<light + dark, desktop + 375px, for each changed screen>

## Tests

- Unit/worker: <added>, all passing
- E2E: <specs extended>, `pnpm test:e2e`
- Commands run: `pnpm lint`, `pnpm fmt:check`, `pnpm test`, `pnpm test:e2e`, `pnpm build`

## Migrations

<none, or which and why; remote apply NOT done>

## Follow-ups

<gaps found outside this sprint's scope>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## 6. Critérios de pronto (todo sprint)

- [ ] Todos os IDs do sprint entregues ou adiados com motivo registrado no PR.
- [ ] Nenhuma ação nova sem estado de pendente, erro e sucesso.
- [ ] Nenhum `title=` nativo, `backdrop-blur` ou texto técnico novo na interface.
- [ ] Telas conferidas no claro, no escuro, em 375 px e no desktop.
- [ ] `pnpm lint`, `pnpm fmt:check`, `pnpm test`, `pnpm test:e2e` e `pnpm build` passando.
- [ ] Guideline atualizado com `[x]`.
