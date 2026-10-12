# Sprint 2: navegador e acabamento (N2–N11)

> Antes de qualquer coisa, leia **[`00-base.md`](00-base.md)** e siga as regras dele. Este arquivo só acrescenta o escopo do sprint.

**Branch:** `fix/ux-browser-polish` · **PR:** `fix: replace native browser ui with app components`

## Objetivo

Nada de controle nativo do navegador destoando do design: tooltips, autopreenchimento, "x" de busca, spinners, data e título da aba. O sprint é só de CSS, atributos e componentes, **sem mudança de servidor**, exceto liberar os arquivos do N10 no gate de autenticação.

## Decisões do usuário (pergunte no plano)

- **N6:** manter a data nativa com o estilo do `Input` (recomendado, zero dependência) ou criar um calendário próprio com `react-day-picker`, que é dependência nova e precisa de aprovação.

## Escopo

- **N2, autopreenchimento:** em `src/styles.css` (camada base), adicione `input:-webkit-autofill` (com `:hover`, `:focus` e `:active`) usando `box-shadow: inset 0 0 0 1000px <fundo do input>` e `-webkit-text-fill-color: var(--foreground)`, além de `caret-color`. Teste no claro e no escuro com o login: o Chrome preenche o campo de senha quando há senha salva.
- **N3, título da aba:**
  - Adicione `head: () => ({ meta: [{ title: "Leads · Nelcota Leads" }] })` em cada rota: Visão geral, Leads, Conversas, Buscas, Conta e Configurações.
  - Em Conversas, mostre a contagem de "Precisa de você" na frente do título: "(3) Conversas · Nelcota Leads".
  - Faça o mesmo, de forma global, com um efeito pequeno no `AppShell` usando o `attentionQuery`. A contagem aparece em qualquer aba do app, sem duplicar o "(n)".
- **N4, tooltips nativos:**
  - Remova todo `title=` de elementos interativos e use `Tooltip`/`TooltipContent` (o `TooltipProvider` já está no `AppShell`).
  - Mantenha o `aria-label`.
  - Em `ui/sidebar.tsx`, troque "Toggle Sidebar" por "Mostrar/ocultar barra lateral" e confira os outros textos em inglês no mesmo arquivo.
  - Faça `grep -rn 'title=' src` e trate cada caso. Props `title` de componentes próprios (`Section`, `EmptyState`) não contam.
- **N5, composer sólido:** em `conversas.tsx`, tire `data-glass`, `backdrop-blur-*` e o fundo translúcido do composer. Use uma superfície sólida (`bg-card` ou o token equivalente do tema) com a sombra atual. Rode `grep -rn "backdrop-blur\|data-glass" src` e, se houver outros, liste no PR como follow-up, sem mexer.
- **N6, data:** conforme a decisão. Na opção recomendada, o `<input type="date">` usa as mesmas classes do `Input` (altura 32 px, raio, fundo e foco) e ganha um `aria-label` claro.
- **N7, campos numéricos:** esconda os spinners via CSS (`::-webkit-inner-spin-button`, `::-webkit-outer-spin-button`, `-moz-appearance: textfield`) **só** nos inputs numéricos do app. Para nota mínima e pesos, crie um stepper compacto (−, valor, +) com os componentes atuais: botões `icon-sm`, `aria-label` "Diminuir"/"Aumentar" e respeitando `min`/`max`. Os pesos aceitam negativos.
- **N8, busca de leads:** esconda o `::-webkit-search-cancel-button` e adicione um botão "Limpar busca" (ícone X, `icon-sm`, com tooltip) dentro do campo, visível só quando há texto. Esc limpa quando o foco está no campo.
- **N9, links externos:** todo `<a target="_blank">` do app ganha o mesmo ícone `ArrowUpRightIcon` do link do site e `rel="noopener noreferrer"`. Para não repetir, crie um componente `ExternalLink` em `apple-ui.tsx`.
- **N10, barra do navegador e ícone de app:**
  - `<meta name="theme-color">` com `media="(prefers-color-scheme: dark)"` e outro para o claro, com as cores do fundo da sidebar, mais `<meta name="color-scheme" content="dark light">` em `__root.tsx`.
  - `apple-touch-icon.png` 180×180 e `manifest.webmanifest`, com `name`, `short_name` "Nelcota", `display: "standalone"`, cores e ícones 192/512. Gere os PNGs a partir do `favicon.svg` atual, sem dependência nova: use um script local ou peça os arquivos ao usuário.
  - Adicione esses caminhos a `PUBLIC_PATHS` em `src/server/auth.ts`, com teste em `auth.test.ts` confirmando que são públicos e que nada mais ficou público.
- **N11, Caps Lock no login:** em `src/routes/login.tsx`, detecte com `event.getModifierState("CapsLock")` em `onKeyDown`/`onKeyUp` e mostre "Caps Lock ativado" na linha de erro (`#login-error`, cor terciária) quando não houver erro. Não esconda o erro de senha.

## Testes

- **E2E:**
  - O título da aba muda por rota (`expect(page).toHaveTitle(...)`).
  - Tooltip aparece no hover/foco do botão "Verificar e-mails".
  - Botão de limpar busca funciona.
  - Stepper respeita `min`/`max`.
  - Login mostra o aviso de Caps Lock (`page.keyboard.press("CapsLock")`, se o navegador do Playwright suportar; senão, teste o componente via evento sintético).
- **Unit/worker:** `PUBLIC_PATHS` (N10).
- **Visual:** capturas de login (com autopreenchimento), Conversas (composer), lead (data), Configurações (steppers) e Leads (busca), no claro e no escuro.

## Critérios de aceite específicos

- [ ] `grep -rn 'title=' src` só encontra props de componentes próprios.
- [ ] `grep -rn 'backdrop-blur' src` não encontra nada em telas, ou os casos restantes estão listados no PR.
- [ ] Nenhum campo do app com fundo azul ou amarelo de autopreenchimento.
- [ ] O app instalado (Chrome → Instalar) abre com ícone e nome corretos.
