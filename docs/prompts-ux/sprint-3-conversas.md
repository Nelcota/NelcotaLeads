# Sprint 3: responder o cliente (C1–C7)

> Antes de qualquer coisa, leia **[`00-base.md`](00-base.md)** e siga as regras dele. Este arquivo só acrescenta o escopo do sprint.
>
> **Depende do Sprint 1** (rascunho do usuário, status `cancelled` e helper de toasts). Confirme que está mergeado.

**Branch:** `feat/ux-conversations` · **PR:** `feat: faster replies in conversations`

## Objetivo

Responder um cliente em Conversas fica rápido e sem atrito: achar a conversa, pedir ajuda à IA, enviar pelo teclado e ler só o que importa.

## Decisões do usuário (pergunte no plano)

- **C7, respostas rápidas:** entra neste sprint ou fica para depois? Se entrar, confirme onde os modelos são editados (recomendado: um grupo novo em Configurações → "Respostas rápidas") e o limite (recomendado: até 10 modelos de até 1.000 caracteres).

## Escopo

- **C1, ⌘/Ctrl + Enter:** no `Textarea` do composer, `metaKey || ctrlKey` + Enter envia, se o botão estiver habilitado. O tooltip do botão "Enviar" mostra "Enviar ⌘↵" no Mac e "Enviar Ctrl+Enter" nos outros sistemas; detecte com `navigator.platform`/`userAgentData` uma vez.
- **C2, buscar conversa:**
  - Um `Input` compacto (altura 30 px, ícone de lupa, botão de limpar do Sprint 2), acima das abas.
  - Filtra no cliente por nome, e-mail e prévia, sem acento e sem diferenciar maiúsculas.
  - O termo fica na URL (`?q=`) e as contagens das abas consideram a busca.
  - Lista vazia por causa da busca mostra "Nenhuma conversa com 'termo'." e um botão "Limpar busca".
- **C3, escrever com a IA:**
  - Botão secundário roxo no rodapé do composer: "Escrever com IA" quando o campo está vazio e "Reescrever" quando há texto.
  - No servidor, crie `draftReplyWithAi({ leadId, instruction? })`, que reaproveita o analisador de respostas da IA e grava o resultado como **rascunho do usuário** (regra do Sprint 1: o rascunho do usuário vence).
  - Tem estado pendente (o botão vira "Escrevendo…") e Desfazer (toast que restaura o texto anterior).
  - O resultado passa pela mesma validação de saída que o auto-responder já usa: links, e-mails, telefones e preços. Se reprovar, mostre "A IA não conseguiu uma resposta segura. Escreva você mesmo."
- **C4, WhatsApp na conversa:** um `IconTile` verde ao lado de Ligar e Site na coluna direita, e um botão no carrossel mobile. Use `whatsappLink` de `src/lib/phone.ts`, aparecendo só com `phoneE164`, e o `ExternalLink` do Sprint 2.
- **C5, teclado:**
  - J/K vão para a conversa seguinte/anterior **da lista filtrada**, e Esc fecha a conversa no mobile.
  - Ignore os atalhos com foco em `input`, `textarea` ou `contenteditable`, ou com modificador.
  - Reaproveite o padrão de `lead-sheet.tsx`. Se fizer sentido, extraia um hook `useListHotkeys` usado pelos dois.
  - Os atalhos aparecem nos tooltips e na ajuda do Sprint 4 (deixe uma constante exportada com a lista).
- **C6, texto citado:**
  - Crie a função pura `splitQuoted(body): { visible: string; quoted: string | null }` em `src/lib/mail/`.
  - Ela reconhece:
    - "Em <data>, <nome> escreveu:" (pt) e "On <date>, <name> wrote:" (en);
    - o separador do Outlook ("De:/From:" seguido de "Enviado:/Sent:");
    - "-----Original Message-----" e "-----Mensagem original-----";
    - um bloco final de linhas com `>`.
  - Nunca esconde tudo: se `visible` ficar vazio, mostre o corpo inteiro.
  - No `Message`, a parte citada fica recolhida atrás de um link discreto "Mostrar mensagem anterior" / "Ocultar". Mensagens enviadas por nós não são cortadas.
- **C7, respostas rápidas** (só se aprovado):
  - Guardadas nas settings com schema Zod e limites.
  - No composer, o botão "Modelos" abre um `Popover` com a lista filtrável.
  - Escolher um modelo insere o texto na posição do cursor (não substitui) e salva o rascunho.

## Testes

- **Unit:**
  - `splitQuoted`: teste de tabela com Gmail pt/en, Outlook, Apple Mail, `>`, sem citação e só citação.
  - Normalização da busca (acentos).
- **Worker:** `draftReplyWithAi` grava rascunho do usuário, respeita a validação de saída e não envia nada.
- **E2E (`e2e/conversation.spec.ts`):**
  1. Buscar por nome filtra a lista e atualiza as contagens.
  2. "Escrever com IA" preenche o composer, e Desfazer volta o texto anterior.
  3. Ctrl+Enter envia (o fake mailer recebe exatamente 1).
  4. Uma resposta recebida com citação mostra só o texto novo, e "Mostrar mensagem anterior" revela o resto.
  5. J/K navegam e não disparam com o foco no composer.

## Critérios de aceite específicos

- [ ] O composer continua com no máximo um botão primário ("Enviar"); IA e Modelos são secundários.
- [ ] Nenhum atalho dispara enquanto se digita.
- [ ] Toda resposta escrita pela IA passa pela validação de saída antes de chegar ao composer.
