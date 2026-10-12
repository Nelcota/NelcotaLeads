# Sprint 4: suporte (S1–S3)

> Antes de qualquer coisa, leia **[`00-base.md`](00-base.md)** e siga as regras dele. Este arquivo só acrescenta o escopo do sprint.
>
> **Depende do Sprint 1** (helper de toasts). Os atalhos do Sprint 3 entram na ajuda se ele já estiver mergeado; senão, liste só os que existem.

**Branch:** `feat/ux-support` · **PR:** `feat: system status and in-app help`

## Objetivo

O usuário fica sabendo quando algo automático falhou, sem abrir log, e tem ajuda curta dentro do app para os conceitos e atalhos. Sem chat, sem widget de terceiros e sem poluir a tela no dia a dia.

## Decisões do usuário

Nenhuma. Este sprint **cria uma migration**: aplique só localmente e descreva no PR.

## Escopo

### S1: saúde do sistema

- **Tabela `job_runs`** (Drizzle + `pnpm db:generate`), com uma linha por tarefa e chave `job` (`send`, `inbox`, `follow-ups`, `auto-dispatch`, `autopilot`, `analysis-queue`). Colunas:
  - `lastRunAt`, `lastOkAt`, `lastErrorAt`;
  - `lastError`: mensagem **amigável**, nunca o texto cru, que continua no `console.error`;
  - `consecutiveFailures`.

  Grave com upsert.

- **Gravação:**
  - Em `src/server/tick.ts`, a função `step()` passa a registrar sucesso ou falha em `job_runs`.
  - Os botões manuais ("Verificar e-mails", "Rodar busca diária") registram também.
  - O consumer da fila registra a falha de análise que chega na DLQ.
  - Converta erros em mensagens amigáveis com um mapa pequeno: conexão SMTP/IMAP recusada → "A caixa de e-mail recusou a conexão. Confira a senha em Configurações."; limite do Google → "O limite diário do Google acabou."; e um padrão.
  - Uma falha ao gravar `job_runs` nunca derruba o tick.
- **Server function** `getSystemStatus()` (GET), que devolve as tarefas com o estado derivado:
  - `ok`: último sucesso depois da última falha;
  - `warning`: uma falha, ou nenhuma execução há mais que o dobro do intervalo esperado;
  - `error`: 3 ou mais falhas seguidas;
  - `off`: tarefa desligada, por exemplo modo automático desligado ou caixa não configurada.
- **UI em Conta → grupo "Status"**:
  - Uma lista agrupada (`grouped`) com uma linha por tarefa: bolinha de cor (verde, laranja, vermelho ou cinza), nome em português ("Envio de e-mails", "Leitura da caixa"…) e "há 3 min" em `tabular-nums`.
  - Em falha, mostre a mensagem amigável e o botão "Tentar agora" (reaproveite `checkMailNow`/`runAutopilotNow` quando houver; tarefa sem ação manual não tem botão).
  - Use `refetchInterval` de 60 s só enquanto a tela estiver aberta.
- **Aviso na sidebar:** um ponto laranja no item **Conta** só quando houver tarefa em `error` nas últimas 24 h, com tooltip "Algo precisa de atenção". Reaproveite o `providerStatusQuery` ou crie uma query leve; sem request extra por página se der para juntar.

### S2: central de ajuda leve

- Um botão "?" (ícone `CircleHelpIcon`, `icon-sm`, com tooltip "Ajuda") no rodapé da sidebar, ao lado do botão de tema. No modo recolhido, aparece só o ícone.
- O botão abre um `Sheet` lateral com quatro seções em lista agrupada:
  1. **Como funciona:** os 5 passos do README em uma linha cada.
  2. **Atalhos de teclado:** lidos da constante exportada no Sprint 3 e do `lead-sheet`, com `<kbd>` estilizado.
  3. **Glossário:** nota 0–100, nota mínima, modo automático, "Precisa de você", "IA no comando", limite diário e "sair" (descadastro).
  4. **Status:** um resumo de uma linha com link para Conta → Status.
- O conteúdo fica em um arquivo de dados (`src/lib/help.ts`), não espalhado em JSX.
- `?` (Shift + /) abre a ajuda de qualquer tela, exceto com foco em campo de texto.

### S3: dicas nos conceitos

- Crie o componente `InfoTip({ children })`: um ícone `InfoIcon` de 14 px na cor terciária, com `Tooltip` e `aria-label` "Mais informações".
- Use **só** em:
  - nota (cabeçalho da coluna em Leads e `ScoreBadge` no detalhe);
  - nota mínima (Configurações);
  - modo automático (Visão geral e Configurações);
  - limite diário (medidor da sidebar);
  - "Precisa de você" (aba de Conversas).
- O texto vem do mesmo glossário de `src/lib/help.ts`.

## Testes

- **Worker:**
  - O `step()` grava ok e falha.
  - Uma falha na gravação não derruba o tick.
  - A derivação de estado de `getSystemStatus` (teste de tabela com tempos).
  - O mapa de mensagens amigáveis nunca devolve o texto cru.
- **E2E (novo `e2e/support.spec.ts`):**
  1. Com o fake de falha do mailer, um tick gera o status vermelho em Conta, e o ponto aparece na sidebar.
  2. "Tentar agora" com o fake recuperado volta o status para verde.
  3. "?" abre a ajuda, e Esc fecha.
  4. O tooltip do `InfoTip` aparece no foco por teclado.

## Critérios de aceite específicos

- [ ] Nenhuma mensagem de erro técnica chega à tela de Status.
- [ ] Sem falha, a sidebar não ganha nenhum elemento novo além do "?".
- [ ] Migration gerada, aplicada só localmente e descrita no PR.
