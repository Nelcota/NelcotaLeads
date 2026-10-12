# Sprint 5: listas e formulários (A1–A16)

> Antes de qualquer coisa, leia **[`00-base.md`](00-base.md)** e siga as regras dele. Este arquivo só acrescenta o escopo do sprint.
>
> **Depende dos Sprints 1 e 2** (helper de toasts, `cancelled`, `ExternalLink`, stepper).

**Branch:** `feat/ux-list-actions` · **PR:** `feat: missing actions in searches, leads and settings`

O sprint é grande. Se passar de cerca de 1.500 linhas de diff, divida em dois PRs na mesma ordem: **5a** (A1–A7, A14–A15: buscas e listas) e **5b** (A8–A13, A16: lead e formulários). Pergunte ao usuário antes de dividir.

## Decisões do usuário (pergunte no plano, antes de codar)

1. **A3, excluir busca.** `leads.searchId` referencia `searches.id` sem cascade (`src/db/schema.ts`, por volta da linha 96). As opções são:
   - **(a)** "Ocultar busca": a busca some da lista e os leads ficam. É a recomendada, porque não perde histórico nem conversas.
   - **(b)** Excluir a busca e os leads **ainda não contatados**, mantendo os contatados presos a ela, o que exige uma busca "removida".
   - **(c)** Excluir tudo, incluindo conversas. Não recomendada.
2. **A9, lead manual.** Quais campos são obrigatórios (sugestão: nome + e-mail ou telefone) e se o lead manual passa pela análise da IA, que consome DeepSeek. Ele também precisa de uma "busca" de origem: sugestão de uma busca fixa "Adicionados manualmente" por usuário.
3. **A2, cancelar busca.** Confirme que o que já foi coletado e analisado fica. Requisições ao Google já feitas não são devolvidas.

## Escopo

### Buscas (`src/routes/searches/index.tsx`, `src/server/searches.ts`, `src/server/consumer.ts`)

- **A1, tentar de novo:** busca `error` mostra "Tentar de novo" no próprio card. Ele cria uma busca nova com o mesmo nicho, cidade e quantidade, passando pelas mesmas checagens de chave e de limite diário.
- **A2, cancelar:**
  - Novo status `cancelled` em `SEARCH_STATUSES`.
  - `cancelSearch({ id })` só vale para `collecting`/`analyzing`.
  - O consumer ignora (ack sem processar) mensagens de busca cancelada, e a contagem de analisados para.
  - No card em andamento, um link discreto "Cancelar" ao lado do progresso, com toast "Busca cancelada" (sem desfazer).
  - O badge de status ganha "Cancelada" em cinza.
- **A3, repetir e excluir:** menu "…" (`DropdownMenu`) no card com **Repetir** (igual ao A1) e **Ocultar** ou **Excluir**, conforme a decisão 1. A exclusão pede confirmação em `AlertDialog`, dizendo quantos leads são afetados.
- **A4, card clicável:** o card inteiro vira link para `/leads?search=<id>` (ou o filtro equivalente que existe), mantendo o menu "…" e os botões clicáveis com `stopPropagation`. Busca sem resultados não é link.

### Leads (`src/routes/leads/index.tsx`, `src/server/leads.ts`, `src/server/leads-query.ts`)

- **A5, ações em massa:**
  - Na barra flutuante de seleção, "Disparar e-mail" continua sendo o primário.
  - Um menu "…" traz:
    - **Mudar status** (submenu com os status permitidos; o servidor valida cada lead pela máquina de `lead-status.ts` e devolve quantos mudaram e quantos foram ignorados);
    - **Descartar** (toast com Desfazer, que restaura o status anterior de cada lead);
    - **Exportar seleção** (CSV com os ids selecionados, reaproveitando a rota `/api/leads.csv` com um parâmetro `ids`, limitado a 1.000 e validado).
  - Server function `bulkUpdateLeads({ ids: max(500), status })`.
- **A6:** limpe a seleção ao mudar a aba, os filtros, a busca ou a ordenação.
- **A7:** a lista usa `queryLeadsCapped`. Quando `truncated`, mostre uma linha discreta no fim da tabela: "Mostrando 1.000 de N. Refine os filtros para ver o resto."
- **A15, direção da ordenação:**
  - Um botão `icon-sm` (ícones `ArrowUpNarrowWide`/`ArrowDownWideNarrow`) ao lado do Select, com tooltip "Crescente"/"Decrescente".
  - A direção fica na URL (`dir=asc|desc`), validada por enum no servidor (whitelist, nunca interpolada).

### Painel do lead (`src/components/lead-detail.tsx`)

- **A8, editar dados:**
  - Na seção Contato, nome, e-mail, telefone e site viram edição inline: clicar no valor ou no lápis no hover abre um `Input`; Enter salva, Esc cancela e clicar fora salva.
  - O servidor valida (e-mail com Zod e minúsculo, telefone por `toE164`, site por `safeHttpUrl`) e recusa e-mail descadastrado com mensagem clara.
  - Lead sem e-mail mostra "Adicionar e-mail" no lugar do valor.
- **A10, notas:** depois de salvar no blur, mostre "Salvo" em cinza ao lado do título por 2 s. Em erro, use o toast padrão e mantenha o texto.

### Novo lead (A9)

- "Adicionar lead" no menu "…" da página Leads abre um `Sheet` curto com os campos da decisão 2.
- O lead criado abre direto no painel. Se a análise for ligada, ele entra na fila como os outros.
- Server function `createLead` com `.validator` e limites, deduplicando por e-mail e telefone. Se o lead já existir, oferece "Abrir o existente".

### Formulários (`src/routes/settings.tsx`, `src/routes/conta.tsx`)

- **A11, alterações não salvas:** use `useBlocker({ shouldBlockFn: () => isDirty, enableBeforeUnload: () => isDirty, withResolver: true })` do TanStack Router nos formulários de Configurações (os dois) e de Conta. Mostre um `AlertDialog` "Descartar alterações?" com **Continuar editando** (padrão) e **Descartar**.
- **A12:**
  - Remover nicho ou critério mostra toast com Desfazer, que reinsere na mesma posição.
  - "Descartar" da barra flutuante pede confirmação no mesmo `AlertDialog`.
  - O formulário do modo automático ganha "Descartar" quando estiver modificado.
- **A13, motivo do desabilitado:**
  - "Disparar" sem e-mail na seleção: "Nenhum lead selecionado tem e-mail".
  - "Adicionar nicho" no limite: "Máximo de 10 nichos".
  - Switches do modo automático: o motivo que já existe na dica.
  - Envolva o botão desabilitado num `span` focável (`tabIndex={0}`) para o tooltip funcionar.
- **A16:**
  - Os campos de perfil ficam só em Conta. Em Configurações, uma linha "Nome e empresa do remetente" com link "Editar em Conta".
  - `/leads/$leadId` e `/searches/$searchId` validam a existência no loader e, se não houver, redirecionam para a lista com o toast "Lead não encontrado" / "Busca não encontrada".

### Visão geral (A14, `src/routes/index.tsx`)

- Cada etapa do funil vira link para Leads com o filtro correspondente.
- Cada item de atividade abre o lead (painel) ou a conversa.
- "Ver tudo" leva a Leads ordenado por atualização recente, ou a uma lista de atividade, se for simples. Senão, registre como follow-up.

## Testes

- **Worker:**
  - `cancelSearch` e o consumer ignorando a busca cancelada.
  - `bulkUpdateLeads` respeitando transições e descadastro.
  - Desfazer do descarte em massa.
  - `createLead` com deduplicação.
  - Validação do update inline.
  - A opção de exclusão/ocultação escolhida.
  - `queryLeadsCapped` com `truncated`.
  - Direção da ordenação por whitelist.
- **E2E (estender `search.spec.ts`, `leads.spec.ts` e `settings.spec.ts`):**
  1. Busca com falha (fault `places`) mostra "Tentar de novo", e a nova busca roda.
  2. Cancelar uma busca em andamento.
  3. Selecionar 3 leads, descartar e desfazer.
  4. Editar o e-mail inline e recarregar: está salvo.
  5. Sair de Configurações com alteração pede confirmação, e "Continuar editando" mantém os valores.
  6. Clicar numa etapa do funil abre Leads filtrado.

## Critérios de aceite específicos

- [ ] Cada card, linha e barra continua com no máximo um botão primário visível; o resto fica no "…".
- [ ] Toda ação destrutiva tem Desfazer, ou confirmação quando é irreversível (excluir busca).
- [ ] Nenhum botão desabilitado sem tooltip explicando o motivo.
- [ ] As decisões 1–3 do usuário estão registradas no PR.
