# Sprint 1: nada se perde (T1–T9)

> Antes de qualquer coisa, leia **[`00-base.md`](00-base.md)** e siga as regras dele. Este arquivo só acrescenta o escopo do sprint.

**Branch:** `feat/ux-no-lost-work` · **PR:** `feat: never lose user work in conversations and drafts`

## Objetivo

O usuário nunca perde texto digitado, nunca encerra uma conversa sem volta e nunca fica sem saída diante de um e-mail com falha ou na fila. Nenhuma ação falha em silêncio.

## Decisões do usuário

Nenhuma. Se o plano mostrar a necessidade de uma, pergunte antes de implementar.

## Escopo, na ordem de implementação

### 1. T2: status `cancelled` (base para T1, T6 e T7)

- Adicione `cancelled` a `EMAIL_STATUSES` (`src/db/schema.ts`). Não há CHECK no SQL; confirme nas migrations em `drizzle/` antes de concluir que não precisa de migration.
- Troque `status: "failed"` por `cancelled` **apenas** nos cancelamentos, mantendo o motivo em `error`. Hoje eles estão em `mail-flow.ts`, nas linhas próximas de 588 (opt-out), 597 (`cancelQueuedAi`) e 734 (conversa encerrada). Falhas reais de envio e de limite diário continuam `failed`.
- Procure toda leitura de `status` de e-mail (dashboard, uso, contagens, filtros de thread, CSV) e decida em cada uma como tratar `cancelled`. Registre a decisão no PR.
- Na thread (`conversas.tsx`, componente `Message`), um e-mail `cancelled` aparece em cinza, com o motivo e sem a borda vermelha.

### 2. T1: encerrar com desfazer, e reabrir

- `closeConversation` para de **apagar** rascunhos e e-mails da fila: passa a marcar como `cancelled`. Ele devolve um retrato `{ previous: { status, aiMode, handoffReason }, cancelledIds }`.
- Crie `undoCloseConversation({ leadId, previous, cancelledIds })`. Ela restaura o lead **exatamente** como estava e devolve para `queued`/`draft` só os ids informados que ainda estão `cancelled` com o motivo de encerramento.
  - Essa restauração fica fora da máquina de transições normal, porque `discarded → replied` não é permitido em `LEAD_TRANSITIONS`. Valide no servidor que o lead está `closed`/`discarded` e que os ids pertencem a ele.
  - Nunca restaure um lead descadastrado (`unsubscribedAt`) para estados de contato.
- Na UI, ao encerrar, mostre o toast "Conversa encerrada" (ou "Encerrada sem negócio") com a ação **Desfazer**, por cerca de 6 s.
- Conversa encerrada ganha **"Reabrir conversa"** no mesmo lugar dos botões de encerrar (coluna direita e carrossel mobile). A transição `closed → replied` já existe. Para `discarded`, reaproveite a regra de `lead-status.ts` e, se não houver transição permitida, mostre o botão desabilitado com o motivo.

### 3. T3: rascunho de resposta salvo

- Crie `saveReplyDraft({ leadId, body })`. Ela faz upsert de **um** rascunho por lead com `author: "user"`, `inReplyTo` igual à última mensagem recebida e corpo com `max(5000)`. Corpo vazio apaga o rascunho do usuário.
- Regra: **o rascunho do usuário vence.**
  - `getConversation` devolve o rascunho do usuário quando existir. Hoje ele pega `.at(-1)` de qualquer rascunho (`mail.ts`, por volta da linha 215).
  - O `leaveDraft` da IA (`mail-flow.ts`, por volta da linha 695) não cria rascunho novo se já existir um do usuário para o lead. Com a IA no comando, o rascunho do usuário também desliga o envio automático daquela resposta, e a conversa passa para "Precisa de você".
  - `prepareDrafts`/`queueDrafts` nunca tratam um rascunho com `inReplyTo` como primeiro e-mail.
  - `sendReply` continua apagando o rascunho ao enviar.
- Na UI, salve com debounce de cerca de 800 ms. No rodapé do composer, mostre "Salvando…" e depois "Rascunho salvo" no lugar de "A assinatura é adicionada no envio" (que volta quando não há rascunho). Use `useDeferredValue` ou debounce com cleanup, sem uma request por tecla.

### 4. T4: edições do disparo e do lead

- No `dispatch-sheet.tsx` e no passo de e-mail de `lead-detail.tsx`, as edições de rascunhos que existem no servidor são salvas com debounce via `updateDraft`, com o mesmo indicador de "salvo".
- A primeira mensagem de WhatsApp (`FirstContactStep`, por volta de `lead-detail.tsx:330`) não tem rascunho no servidor. Ao fechar o Sheet com edição pendente, pergunte com um `AlertDialog` simples: "Descartar alterações?", com os botões **Continuar editando** (padrão) e **Descartar**.

### 5. T5: "Gerar outro" com desfazer

- Antes de chamar `rewriteDraft`, guarde `{ subject, body }` atuais. Ao concluir, mostre o toast "Nova versão gerada" com **Desfazer**, que grava a versão anterior via `updateDraft`. Faça o mesmo no disparo e no lead.
- Adicione o `onError` que falta em `lead-detail.tsx` (rewrite, por volta da linha 498).

### 6. T6: tentar de novo um e-mail com falha

- Crie `retryEmail({ emailId })`. Ela só aceita `status = "failed"` e `direction = "out"`, e só para lead não descadastrado.
  - Cria uma **linha nova** `queued`, com `sendAfter = now` e `sentAt = null`, copiando assunto, corpo, destinatário (do lead no banco) e `inReplyTo`.
  - A linha antiga continua `failed`, marcada como "reenviado". Use um campo existente ou `error`; se não der, pergunte antes de criar coluna.
  - O envio sai pelo `sendDue` normal, que já respeita a reserva atômica e o limite diário.
- Na UI, o link "Tentar de novo" aparece na própria mensagem, ao lado do horário. Se a falha foi por limite diário, mostre "Tenta amanhã" sem link.
- **Teste obrigatório:** dois `retryEmail` concorrentes sobre o mesmo id criam no máximo uma linha nova, e um tick depois do retry envia exatamente uma vez.

### 7. T7: cancelar ou editar e-mail na fila

- `cancelQueuedEmail({ emailId })` só vale para `queued` com `sentAt IS NULL` (não reservado). Use `UPDATE … WHERE` atômico, conferindo `changes`. Se já estiver sendo enviado, devolva "Já está saindo, não dá mais para cancelar."
- `editQueuedEmail({ emailId })` tem as mesmas condições e transforma a linha em rascunho do usuário (respeitando T3), que vai para o composer.
- Na UI, "Cancelar" e "Editar" aparecem na própria mensagem, só nesse estado.

### 8. T8: erros nunca silenciosos

- Crie um helper pequeno (ex.: `src/lib/mutation-toasts.ts`) que devolve `onError` com uma mensagem padrão em português e aceita mensagem própria. Use `error.message` apenas quando ela vier das mensagens amigáveis do servidor.
- Aplique o helper em todas as `useMutation` do app sem `onError`. Pelo menos: "Tirar do disparo" e o switch de IA (`dispatch-sheet.tsx`), rewrite no lead e "Testar conexão" (`settings.tsx`), que hoje só trata `ok:false` e não a queda da rede.

### 9. T9: mensagens em linguagem de usuário

- `new-search-dialog.tsx` (blocker de chaves) e `settings.tsx` (caixa não conectada): troque por "A chave do Google não está configurada. Fale com quem administra o sistema." e mensagens equivalentes. As instruções técnicas vão para o README, se ainda não estiverem lá.
- `route-error.tsx` mostra uma mensagem amigável fixa e um botão discreto **"Copiar detalhes"**, que copia nome, mensagem e rota do erro para a área de transferência, com o toast "Copiado".

## Testes

- **Worker (`*.worker.test.ts`):**
  - `closeConversation` → `undoCloseConversation` restaura lead e fila.
  - Undo com id de outro lead é recusado.
  - Lead descadastrado não é restaurado.
  - `saveReplyDraft` com upsert único.
  - A IA não cria rascunho por cima do rascunho do usuário.
  - `prepareDrafts` ignora rascunho de resposta.
  - `retryEmail` com concorrência e limite diário.
  - `cancelQueuedEmail` em e-mail reservado devolve erro.
  - Cancelamentos gravam `cancelled`.
- **E2E (estender `e2e/conversation.spec.ts` e `e2e/dispatch.spec.ts`):**
  1. Encerrar → Desfazer → a conversa volta ao mesmo filtro, com a mesma IA.
  2. Digitar uma resposta, trocar de conversa e voltar: o texto está lá. Recarregar: o texto continua lá.
  3. Uma falha de envio (fault do fake mailer) mostra "Tentar de novo", e o retry envia uma vez só.
  4. "Gerar outro" seguido de Desfazer restaura o texto editado.

## Critérios de aceite específicos

- [ ] Nenhum `db.delete(emails)` sobra nos fluxos de encerrar ou cancelar (só em "Tirar do disparo", que apaga um rascunho que nunca saiu).
- [ ] Nenhuma mensagem cancelada aparece em vermelho.
- [ ] Texto digitado em Conversas, no disparo ou no passo de e-mail sobrevive a troca de tela e a reload.
- [ ] Nenhuma `useMutation` sem `onError` no app (`grep` no PR).
