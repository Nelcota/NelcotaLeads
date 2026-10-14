# Prompt: 2ª revisão de robustez + padrões de navegador

> Cole este documento inteiro como prompt para o agente que vai executar a revisão.
> Ele **não** pede funcionalidade nova nem mudança de design aprovado. O objetivo é deixar o que já existe correto, seguro, rápido, sem aparência "padrão de navegador" e coberto por testes de ponta a ponta.
>
> **Idioma:** converse com o usuário em português. **Código, comentários, nomes de testes e commits: em inglês.** Textos da interface: em português, no tom do app.

---

## 0. Ordem de prioridade (não pule etapas)

1. **Sanitização, async, performance e segurança** (seções 3–6) — sempre primeiro.
2. **Problemas de lógica** (seção 7).
3. **Testes de ponta a ponta** (seção 8) para tudo que foi corrigido.
4. **Coisas que ainda estão com o padrão do navegador** (seção 9).

Cada achado vai para `docs/revisao-2-achados.md` com id, arquivo, severidade, achado, correção e status (corrigido / adiado + motivo / falso positivo).

---

## 1. Contexto

O Nelcota Leads é um app de prospecção B2B: busca empresas no Google Places, a IA (DeepSeek) analisa e escreve e-mails, o app envia por SMTP e lê respostas por IMAP a partir de um cron por minuto. Stack: TanStack Start (React 19) em Cloudflare Workers · D1 + Drizzle · Queues · Zod 4 · TanStack Query · Tailwind v4 + shadcn/ui + `src/components/apple-ui.tsx` · Vitest (`unit` e `workers`) · Playwright (`e2e/`, com Google, IA e e-mail simulados via `E2E=1`) · oxlint/oxfmt · pnpm.

**Já foi feita uma 1ª rodada** ([`prompt-hardening-review.md`](prompt-hardening-review.md) → [`hardening-findings.md`](hardening-findings.md)) e um sprint de navegador ([`prompts-ux/sprint-2-navegador.md`](prompts-ux/sprint-2-navegador.md)). Não refaça o que está marcado como corrigido lá; **confira apenas se continua valendo** (regressão) e concentre-se no código que entrou depois: contas (cadastro, login com bloqueio, redefinição de senha, `account.ts`, `auth-endpoint.ts`, `password.ts`), nichos, status do sistema/`job-runs`, ações em massa, lead manual, respostas rápidas, edição inline/autosave, ações de busca.

Leia antes: `README.md`, `src/db/schema.ts`, `src/server.ts`, `src/server/auth.ts`, `e2e/fixtures.ts`, e os dois documentos acima.

## 2. Regras

- **Escopo:** só consertar; nada de feature nova nem mudança de direção visual (superfícies sólidas, sem blur/vidro/brilho seguindo o mouse, Manrope, cores semânticas também no texto).
- **Infra não é do usuário:** deploy, plano Cloudflare, secrets, migrations remotas e serviços externos vão para a seção "Handoff" do documento de achados. Nunca rode `deploy` nem `db:migrate:remote`. Migrations só locais.
- **Sem dependência nova** sem pedir (nome, motivo, tamanho).
- **Nada contra serviços reais**: testes usam os fakes.
- **Árvore de trabalho compartilhada:** pode haver alterações não commitadas de outras sessões. Não reverta nem reformate o que você não escreveu; não faça commit sem o usuário pedir.
- Cada bug consertado ganha um teste que falha antes e passa depois.
- **Boas práticas de código** (valem para todo código novo ou alterado; não refatore em massa o que não foi tocado sem perguntar):
  - Composição em vez de herança. Funções pequenas, com um nível de abstração cada. Nomes claros, sem abreviações.
  - No máximo 2 ou 3 níveis de `if`/`for`. **Nunca `else`**: use retorno antecipado (ternário para valores é aceito, sem aninhar).
  - Erros: try/catch nos pontos certos, erros tipados, nunca engolir exceção em silêncio (um `catch` vazio precisa dizer onde o erro já foi tratado).
  - Validação com Zod nas bordas; TypeScript strict; sempre checar `null`/`undefined`; imutabilidade sempre que der.
  - Logs estruturados, com nível e sem dados sensíveis (sem senha, token, corpo de e-mail ou resposta crua de provedor). Configuração e segredos só por variável de ambiente.
  - Código assíncrono (`async`/`await`) em tudo que faz I/O; funções puras continuam síncronas (`async` sem I/O só adiciona microtarefas e muda erros síncronos em promessas rejeitadas).
  - Revise espaçamento entre linhas e indentação (o `oxfmt` formata; a separação em blocos lógicos é sua).
  - Commits e PRs atômicos e **sempre em inglês**.
- Siga as skills: `playwright-best-practices` (E2E), `vercel-react-best-practices` (React), `apple-design` (UI), `caveman-commit` (commits).

---

## 3. Sanitização e validação

- Toda server function com entrada tem `.validator(zod)` com `max()` em strings/arrays e `int().min().max()` em números; enums em vez de `string()` livre. Liste as que faltam (inclusive as novas: nichos, respostas rápidas, ações em massa, lead manual, conta).
- Endpoints `/api/*` (login, cadastro, redefinição, logout, CSV, e2e): corpo com limite de tamanho, `Content-Type` verificado, campos com `trim`/NFC e limites, e-mail normalizado em minúsculas.
- Parâmetros de busca na URL (`validateSearch` das rotas): inválidos caem em default, sem quebrar a página; strings limitadas.
- Redirecionamento pós-login (`next`): só caminhos relativos do próprio app (`/x`, nunca `//host`, `/\host`, `javascript:`, URL absoluta).
- Dados de fora (Places, HTML, IA, e-mail recebido, valores do banco) validados na fronteira.
- Texto de terceiros nunca renderizado como HTML; `href` só `http(s):`/`mailto:`/`tel:`/`wa.me` validados.

## 4. Segurança

- Gate de autenticação cobre **todas** as server functions e `/api/*`, exceto `PUBLIC_PATHS`; teste que itera as rotas.
- Senhas: hash lento com sal (PBKDF2/scrypt) e comparação em tempo constante; mensagens de login/cadastro/redefinição não revelam se o e-mail existe; bloqueio por tentativas atômico.
- Sessão: cookie `HttpOnly; Secure; SameSite`, expiração, logout invalida no servidor, troca/redefinição de senha derruba outras sessões.
- CSRF: mutações exigem mesma origem.
- Código de acesso (cadastro/redefinição) com limite de tentativas.
- Rota `/api/e2e` e modo `E2E` impossíveis de ativar em produção.
- Cabeçalhos de segurança presentes; erros ao cliente sem stack, segredo ou texto cru de provedor.

## 5. Async e concorrência

- Sem promessas soltas, `forEach(async)` ou `.then` sem tratamento.
- Reservas atômicas (`UPDATE … WHERE` + conferir `changes`) em tudo que pode rodar duas vezes: cron × "rodar agora", clique duplo, reentrega da fila.
- Toda chamada externa com timeout; falha de um item não derruba o lote.
- Cliente: mutações invalidam as queries certas; botões desabilitados enquanto pendentes; nada de estado otimista que fique errado após falha; requisições canceladas/ignoradas quando o componente sai ou o filtro muda (sem resposta antiga sobrescrevendo a nova).

## 6. Performance

- N+1 no D1 (loops com `await db…` por item) → `inArray`/`db.batch`/agregação.
- Índices para cada `WHERE`/`ORDER BY` frequente das telas novas (nichos, status, conversas).
- Consultas independentes em paralelo; `staleTime`/polling razoáveis; nada de polling com aba oculta se der para evitar.
- Bundle: `pnpm build` e compare; nada pesado carregado nas telas de login.

## 7. Lógica

Para cada regra, ache o código, confirme e aponte/escreva o teste:

- Máquina de status do lead e transições inválidas bloqueadas no servidor.
- Limites diários (Places, e-mail) e virada de dia em Brasília.
- Envio: espaçamento, nunca duplicado, nunca para descadastrado, follow-up único e cancelado por resposta.
- Nichos: contagens e filtros batem com a lista; lead sem nicho; renomear/apagar.
- Ações em massa: só nos selecionados, respeitam transições válidas, contagem correta no toast.
- Status do sistema: "atrasado" só onde há cron; contadores corretos.
- Conta: cadastro duplicado, redefinição com código errado, bloqueio expira.
- Autosave/edição inline: não perde texto ao navegar, não grava valor antigo por cima do novo.

## 8. Testes de ponta a ponta

- Rode `pnpm lint`, `pnpm test`, `pnpm test:e2e` e `pnpm build` **antes** (linha de base) e **depois**.
- Toda correção visível ao usuário ganha (ou estende) um spec em `e2e/`, com locators por role/label, sem `waitForTimeout`, falhando em `console.error` inesperado.
- Cubra também os fluxos novos ainda sem E2E (identifique-os comparando rotas/ações com os specs existentes).

## 9. Coisas que ainda estão com o padrão do navegador

Procure, tela por tela (claro e escuro, desktop e 390 px), tudo que ainda aparece com a cara padrão do Chrome/Firefox/Safari em vez do design do app, e troque pelo componente/estilo do app:

- **Diálogos nativos:** `alert`, `confirm`, `prompt`, `beforeunload` desnecessário → `AlertDialog`/toast/desfazer.
- **Validação nativa:** balão "Preencha este campo" (`required`, `type=email`, `pattern`, `min/max`) → `noValidate` no form + erro inline do app.
- **Controles de formulário:** `<select>` nativo, `type=date/time/number/search/file/color/range`, checkbox/radio nativos, setas de número, "x" de busca, botão "Escolher arquivo", `<details>` com triângulo padrão, `resize` de textarea fora do lugar.
- **Autopreenchimento** amarelo/azul em todos os campos (não só no login); `autocomplete` correto em cada campo (`email`, `current-password`, `new-password`, `one-time-code`, `off` em buscas).
- **Foco:** contorno azul padrão (`outline` do navegador) em qualquer elemento focável (links, células, `tabindex`, itens de menu) → anel de foco do app; nada sem foco visível.
- **Seleção e cursores:** cor de seleção de texto (`::selection`), `caret-color`, `cursor: pointer` em clicáveis, `-webkit-tap-highlight-color` no toque, `user-select` em botões/ícones.
- **Rolagem:** barras de rolagem padrão claras no tema escuro (`color-scheme`, `scrollbar-color`/`scrollbar-width`), `overscroll-behavior` em painéis e sheets, rolagem horizontal da página no mobile.
- **Tipografia e links:** link azul sublinhado/roxo de visitado, fonte serifada/padrão em `button`/`input`/`textarea`/`select` (herdar a fonte), `font-synthesis`, hífen/quebra de palavras em textos longos (e-mails, URLs).
- **Mídia e ícones:** imagem quebrada com ícone padrão, `alt` vazio/ausente, favicon/manifest/ícone de app, `theme-color` e `color-scheme`.
- **Tooltips nativos:** qualquer `title=` restante em elemento interativo.
- **Páginas de erro do navegador:** 404/500, offline e falha de rede mostrando tela padrão em vez de estado do app; impressão (`@media print`) se houver exportação/visualização imprimível.
- **Arrastar:** imagens/links arrastáveis com "fantasma" padrão onde não faz sentido (`draggable=false`).

Para cada item: `grep` no código (`alert(`, `confirm(`, `title=`, `type="date"`, `<select`, `required`, `outline`, `::selection`, `scrollbar`, `autocomplete`), verificação no navegador (pane interno ou Playwright) e um E2E quando o comportamento for testável (ex.: submit vazio mostra erro do app, não balão; nenhum `title` em botões; `color-scheme` no `<html>`).

---

## 10. Critérios de pronto

- [ ] `docs/revisao-2-achados.md` com todos os achados, status e a seção "Handoff" de infra.
- [ ] Nenhuma regressão dos itens da 1ª rodada.
- [ ] Testes de tabela para entradas hostis nas rotas novas (`next`, corpo grande, campos com controle/CRLF, e-mail com maiúsculas/espaços).
- [ ] Nenhum diálogo, balão de validação, tooltip, autopreenchimento, foco ou barra de rolagem com cara de navegador nas telas do app.
- [ ] `pnpm lint`, `pnpm fmt:check`, `pnpm test`, `pnpm test:e2e` e `pnpm build` passando.
- [ ] Nenhuma mudança visual fora do escopo, nenhuma feature nova, nenhum segredo no diff.
