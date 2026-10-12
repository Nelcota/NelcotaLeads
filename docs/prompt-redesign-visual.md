# Prompt: redesign visual do Nelcota Leads, direção "Apple Pro"

> Cole este documento inteiro como prompt para o agente que vai executar a reforma.
> Ele descreve **somente mudanças visuais**. Nada de funcionalidade nova.
>
> **Referência visual obrigatória:** abra [`docs/modelo-apple-pro.html`](modelo-apple-pro.html) no navegador antes de começar. É o modelo aprovado, com todas as telas. Navegue pela barra lateral, clique numa linha da tabela de Leads (abre o painel do lead) e em "Disparar e-mail" (abre a revisão do disparo). Quando este documento e o modelo divergirem, **o modelo vale para a aparência e este documento vale para as regras de escopo**.

---

## 1. Contexto e objetivo

O Nelcota Leads é um app de prospecção B2B de uso próprio (TanStack Start + React 19 + Tailwind v4 + shadcn/ui, em Cloudflare Workers). Ele busca empresas locais no Google Places, analisa cada uma com IA, dispara e-mails e conversa com quem responde.

O visual atual é o tema neutro padrão do shadcn, com aparência de template. O objetivo é transformá-lo num app com acabamento de **aplicativo nativo de Mac da Apple** (macOS recente):

- barra lateral de vidro translúcido flutuando sobre um fundo sutil;
- ícones em quadradinhos coloridos, como nos Ajustes;
- cores do sistema da Apple, aplicadas **ao fundo e ao texto**;
- listas agrupadas com cantos arredondados, botões em cápsula e controles segmentados;
- painéis laterais (sheets) que deslizam com movimento de mola;
- micro-animações em hover, clique e entrada de tela.

**Modo escuro é o principal.** O modo claro precisa funcionar, mas é secundário.

Durante o trabalho, siga as skills do usuário: `apple-design` (UI e movimento), `vercel-react-best-practices` (React) e `caveman-commit` (mensagens de commit).

---

## 2. Regras de escopo (invioláveis)

1. **Só visual.** Pode mudar:
   - classes Tailwind e `src/styles.css`;
   - variantes dos componentes em `src/components/ui/*`;
   - a marcação JSX das telas (ordem, agrupamento, ícones, wrappers);
   - componentes puramente de apresentação (listados na seção 6).
2. **Não pode mudar:** nada em `src/server/`, `src/db/`, `drizzle/`, `src/lib/places`, `src/lib/scrape`, `src/lib/ai`, `src/lib/mail`, `src/lib/queries.ts`, `src/lib/schemas.ts` (só ler), `wrangler.jsonc` e as rotas de API.
3. **Nenhuma funcionalidade, integração, rota, query, mutação, campo, filtro ou atalho de teclado novo.** Toda informação exibida vem de dados que a tela já recebe. É permitido combinar ou formatar dados existentes: calcular a % entre etapas do funil, colorir uma data vencida, gerar iniciais, transformar um número em anel de progresso.
4. **Novos caminhos para ações que já existem são permitidos**, desde que usem as mesmas funções e filtros:
   - o campo "Nova busca" da barra lateral abre o `NewSearchDialog` existente;
   - os cartões de número da Visão geral levam a uma tela já existente;
   - a barra flutuante de seleção usa o mesmo estado `selected`.
5. **Manter todo o comportamento:** parâmetros de URL (`view`, `lead`, `filter`, `searchId`…), atalhos J/K, âncoras `#email` e `#piloto`, `aria-label`s, estados de carregamento, toasts, validações e textos de erro.
6. **Textos:** mantenha os atuais. Só adicione texto quando este documento pedir (linhas de resumo, rótulos de seção).
7. **Nenhuma dependência nova.** A fonte continua Manrope (já instalada). Ícones continuam `lucide-react`. Animações com CSS (transições, `@keyframes`, `@property`). Se em algum ponto for indispensável uma mola com interrupção real (ex.: arrastar), pare e pergunte antes de instalar qualquer coisa.
8. **O que existe no modelo mas NÃO deve ser implementado:**
   - os três "semáforos" (círculos vermelho, amarelo e verde) no topo da barra lateral: são decoração do modelo;
   - o "papel de parede" colorido atrás da janela pode ser implementado (é só CSS), mas fica opcional;
   - os dados de exemplo (nomes, números, endereço).

---

## 3. Mapa do app (o que existe hoje)

| Tela               | Arquivo                                              | Conteúdo atual                                                                                                                                          |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estrutura          | `src/components/app-shell.tsx`                       | `Sidebar` do shadcn, `UsageMeter`, `ThemeToggle`, componente `Page` (cabeçalho fixo + conteúdo)                                                         |
| Visão geral        | `src/routes/index.tsx`                               | `SetupAlerts`, `Attention` ("Precisa de você"), `Stats` (5 números), `Funnel` (6 etapas), `Activity`, `Automation`                                      |
| Leads              | `src/routes/leads/index.tsx`                         | abas de fila (`LEAD_VIEWS`), `Toolbar` (busca, Nota, Busca, Sem site, Com e-mail, ordenação), barra de seleção, `LeadsTable`, contagem                  |
| Painel do lead     | `src/components/lead-sheet.tsx` + `lead-detail.tsx`  | navegação J/K, cabeçalho, `QuickActions`, `NextStep` (5 variações), `AnalysisSection`, `ContactSection`, `NotesSection`, rodapé com status e Reanalisar |
| Revisão do disparo | `src/components/dispatch-sheet.tsx`                  | rascunhos da IA um a um, Gerar outro, Tirar do disparo, "Ficaram de fora", resumo e botão Disparar                                                      |
| Conversas          | `src/routes/conversas.tsx`                           | filtros, lista, conversa (`Thread`, `Message`), compositor, painel de detalhes                                                                          |
| Buscas             | `src/routes/searches/index.tsx`                      | tabela de buscas com progresso                                                                                                                          |
| Nova busca         | `src/components/new-search-dialog.tsx`               | nicho, cidade, quantidade, avisos                                                                                                                       |
| Configurações      | `src/routes/settings.tsx`                            | E-mail, Modo automático (alvos, horário, quantidade), Oferta, Critérios, Mensagem; barra "Alterações não salvas"                                        |
| Estados            | `src/components/route-error.tsx`, `__root.tsx` (404) | erro e página não encontrada                                                                                                                            |

---

## 4. Fundação visual (fazer primeiro, em `src/styles.css`)

### 4.1 Cores: modo escuro (principal)

**Superfícies e texto** (substitua o bloco `.dark`):

| Token                      | Valor                       | Uso                                      |
| -------------------------- | --------------------------- | ---------------------------------------- |
| `--window` (novo)          | `#0A0A0C`                   | fundo da janela, atrás de tudo           |
| `--background`             | `#131315`                   | painel de conteúdo principal             |
| `--card`                   | `#1C1C1E`                   | listas agrupadas, cartões, tabelas       |
| `--card-2` (novo)          | `#242426`                   | elementos dentro de cartões              |
| `--popover`                | `rgba(30,30,32,.94)` + blur | sheets, menus, dialogs                   |
| `--foreground`             | `#F5F5F7`                   | texto principal                          |
| `--muted-foreground`       | `rgba(235,235,245,.64)`     | texto secundário                         |
| `--text-tertiary` (novo)   | `rgba(235,235,245,.48)`     | horários, metadados, rótulos de seção    |
| `--text-quaternary` (novo) | `rgba(235,235,245,.28)`     | setas `›`, placeholders, desabilitado    |
| `--border`                 | `rgba(84,84,88,.42)`        | separadores de 0,5px                     |
| `--fill` (novo)            | `rgba(118,118,128,.20)`     | botões em cápsula, campos                |
| `--fill-2` (novo)          | `rgba(118,118,128,.12)`     | trilho de segmentado, pop-ups            |
| `--fill-3` (novo)          | `rgba(118,118,128,.08)`     | blocos internos (passos de busca, ações) |

**Cores do sistema da Apple** (tokens semânticos novos, iguais no modelo):

| Token      | Escuro    | Claro     | Significado no app                                     |
| ---------- | --------- | --------- | ------------------------------------------------------ |
| `--green`  | `#30D158` | `#248A3D` | ação principal, sucesso, fechado, conectado, nota alta |
| `--orange` | `#FF9F0A` | `#C93400` | precisa de você, atenção, nota média, alertas          |
| `--red`    | `#FF453A` | `#D70015` | erro, falhou, descartar, encerrar                      |
| `--blue`   | `#0A84FF` | `#0040DD` | links, e-mails enviados, novo, manual, conversa aberta |
| `--purple` | `#BF5AF2` | `#8944AB` | **tudo que é da IA**                                   |
| `--teal`   | `#40C8E0` | `#0071A4` | etapa "Com e-mail" do funil                            |
| `--pink`   | `#FF375F` | `#D30F45` | só em avatares                                         |
| `--yellow` | `#FFD60A` | `#B25000` | estrela da nota do Google                              |
| `--gray`   | `#8E8E93` | `#6C6C70` | neutro, sem resposta, encerrada                        |

- `--primary` = `--green`, com texto `#002B0D` sobre ele. O botão principal usa um degradê leve (`#45DB6B` → `#2BC251`) com brilho de 1px no topo e sombra verde suave (veja `.pill.primary` no modelo).
- Exponha todos no `@theme inline` (`--color-green: var(--green)` etc.) para usar `text-green`, `bg-green/15` e similares.

### 4.2 A cor vai também no texto (regra do usuário)

Toda informação com significado aparece **com a cor no texto**, não só em fundos ou pontos:

- contadores ("**3** precisam de você" em laranja, "**38** prontos" em azul, "**4** em análise" em roxo);
- rótulos dos cartões de número e suas legendas;
- nomes das etapas do funil e suas porcentagens;
- verbos da atividade ("respondeu" em verde, "a IA respondeu" em roxo, "e-mail enviado" em azul);
- motivos ("Pediu preço" em laranja), "Sem site" em laranja, "Lendo o site…" em roxo;
- a nota (86 verde, 54 laranja, 24 cinza) e "Automática" (roxo) / "Manual" (azul).

**Etiqueta (badge):** fundo da cor a 16%, texto da cor, cápsula de 21px de altura, `11.5px` peso 500, ponto opcional de 6px.

### 4.3 Mapeamento dos status (use sempre)

| Origem                                | Valor → cor                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Status do lead (`LEAD_STATUS_LABELS`) | Novo `blue` · Contatado `gray` · Respondeu `orange` · Fechado `green` · Descartado `red`                   |
| Faixa da nota (`SCORE_TIERS`)         | Alta `green` · Média `orange` · Baixa `gray` · analisando `purple` com `Sparkles`                          |
| Status da busca                       | Coletando `blue` · Analisando `purple` (ponto pulsando) · Concluída `green` com check · Falhou `red` com X |
| Estado da conversa                    | Precisa de você `orange` · IA conversando `purple` · Sem resposta `gray` · Encerrada `gray` atenuado       |
| Data de retorno                       | vencida `red` · hoje `orange` · futura `gray`                                                              |
| Autor da mensagem                     | IA `purple` · Você `gray` · Empresa sem destaque                                                           |

### 4.4 Modo claro (secundário)

Mesma estrutura: janela `#F2F2F7`, painel `#FFFFFF`, cartões `#FFFFFF` com sombra `0 1px 3px rgba(0,0,0,.06)`, texto `#1D1D1F` / `rgba(60,60,67,.6)` / `rgba(60,60,67,.3)`, separadores `rgba(60,60,67,.29)`, cores semânticas da coluna "Claro". Barra lateral com vidro claro (`rgba(246,246,248,.7)` + blur).

**Tema padrão:** em `src/lib/theme.ts`, sem preferência salva, comece no **escuro**. É a única mudança nesse arquivo.

### 4.5 Tipografia (Manrope em tudo)

- `font-family: "Manrope", sans-serif;` global; `--font-sans: "Manrope", sans-serif;` no `@theme`. Os imports `@fontsource/manrope` (300 a 600) já existem; não adicione outra fonte.
- Todos os números com `font-variant-numeric: tabular-nums`.
- **Pesos:** 300 para texto secundário (legendas, prévias, metadados, rótulos de propriedade); 400 para texto comum; 500 para títulos, botões, menus, números e destaques; 600 só para conversa não lida e iniciais de avatar. **Nunca 700 ou 800.**
- **Escala** (substitua as sobrescritas atuais de `--text-*`):

| Uso                               | Tamanho / peso / espaçamento     |
| --------------------------------- | -------------------------------- |
| Título da página (barra superior) | 26px / 500 / -0.032em            |
| Título de sheet                   | 21px / 500 / -0.025em            |
| Assunto de e-mail                 | 22px / 500 / -0.025em            |
| Título de seção                   | 16px / 500 / -0.015em            |
| Número de cartão                  | 36px / 500 / -0.04em             |
| Texto de interface (base)         | 13px / 400 a 500                 |
| Leitura (e-mails, análise)        | 14px / 400 / altura de linha 1.7 |
| Metadados e legendas              | 12 a 12.5px / 300                |
| Rótulos de seção da barra lateral | 11.5px / 500                     |

### 4.6 Forma, materiais e profundidade

- **Raios:** janela e barra lateral 18px; sheets 16px; listas agrupadas e cartões 16 a 18px; itens de lista selecionados 12px; botões e campos em **cápsula** (999px); pop-ups e itens da barra lateral 8 a 9px; ícones-tile 6px (22px) ou 8px (30px); avatares redondos.
- **Vidro (material):**
  - barra lateral: `rgba(36,36,40,.52)` + `backdrop-filter: blur(44px) saturate(190%)`, com brilho de 1px no topo (`inset 0 1px 0 rgba(255,255,255,.09)`) e borda interna de 1px a 6%;
  - barra flutuante de seleção, compositor de e-mail e "Alterações não salvas": `rgba(44,44,48,.6–.72)` + blur 30px;
  - sheets: `rgba(30,30,32,.94)` + blur 40px.
  - Com `prefers-reduced-transparency: reduce`, troque por fundos sólidos sem blur.
- **Layout de janela:** a barra lateral e o painel de conteúdo flutuam com 10px de margem e 10px entre eles, ambos arredondados, sobre `--window`.
- **Separadores:** linhas de 0,5px recuadas a partir do texto (não da borda), como nos Ajustes.
- **Bordas de rolagem:** em vez de uma linha sob a barra superior, a área rolável usa `mask-image` com um fade de 16px no topo e 24px na base.
- **Ícone-tile:** quadrado com degradê vertical da própria cor (mais claro no topo), brilho de 1px e ícone branco com traço 2.2.

### 4.7 Movimento (seguindo a skill `apple-design`)

- Curva padrão de mola: `--spring: cubic-bezier(.22,1,.36,1)`. Hover e cor: 150 a 200ms. Transformações: 350 a 500ms com `--spring`.
- **Feedback no pressionar:** todo elemento clicável encolhe para `scale(.97)` em 120ms no `:active`.
- **Hover nos cartões principais** (cartões de número e de busca), classe `.lift`:
  - sobe 3px com sombra mais profunda;
  - **brilho que segue o cursor**: `radial-gradient(220px circle at var(--mx) var(--my), rgba(255,255,255,.075), transparent 65%)`, com `--mx`/`--my` atualizados num `pointermove` (um handler pequeno por cartão, ou um componente `Lift`);
  - no cartão de número, o ícone cresce e gira (`scale(1.12) rotate(-6deg)`), o número cresce 4%, o brilho de fundo aumenta e uma seta aparece no canto inferior direito;
  - ao clicar: `translateY(-1px) scale(.985)`.
- **Linhas:** avatar ou ícone cresce 8%; a seta `›` desliza 3px. Na tabela, o avatar cresce e o anel da nota gira. Na lista de conversas, o item desliza 2px.
- **Barra lateral:** os ícones são **cinza** quando o item não está ativo e ganham a cor no hover e no ativo; o ícone cresce 10% no hover.
- **Interruptor:** a bolinha estica (28px) ao pressionar, como no iOS.
- **Entrada de tela:** o conteúdo sobe 6px com fade em 320ms; os cartões entram em cascata (40ms entre eles); **anéis de progresso enchem do zero** (`@property --p` animado) e **barras crescem da esquerda** (`scaleX` de 0 a 1).
- **Sheets:** entram da direita com mola (500ms) e **saem pelo mesmo caminho** (380ms, aceleração); o conteúdo de trás reduz para `scale(.985)` e perde saturação; um véu escuro com blur de 2px cobre o fundo. Esc e clique no véu fecham.
- **`prefers-reduced-motion`:** nada se move. Troque deslizes e molas por fade curto, desligue pulsos, anéis e barras animados. Em telas de toque (`hover: none`) não aplique o hover de elevação.

---

## 5. Componentes base (`src/components/ui/*`)

Ajuste as variantes existentes; não crie variantes que nenhuma tela use.

| Componente                          | Como fica                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Button**                          | `default`: cápsula verde (seção 4.1). `outline`/`secondary`: cápsula `--fill` com brilho de 1px no topo, hover `rgba(118,118,128,.28)`. `ghost`: transparente, hover `--fill-2`. `destructive`: texto `red`, hover com fundo `red/14`. Tamanhos: padrão 36px, `sm` 28px. Todos com `:active scale(.97)`. Ícone 14px à esquerda. |
| **Badge**                           | Etiqueta da seção 4.2, com variantes `green`, `orange`, `red`, `blue`, `purple`, `gray`.                                                                                                                                                                                                                                        |
| **Card**                            | Lista agrupada: `--card`, raio 16px, brilho de 1px no topo, sem borda visível. Título da seção **fora** do cartão, acima dele (padrão Ajustes).                                                                                                                                                                                 |
| **Tabs**                            | Vira **controle segmentado**: trilho `--fill-2` raio 10px com 2px de padding; segmento ativo `#5A5A5E` com sombra e brilho; contadores dentro do segmento, coloridos pela semântica.                                                                                                                                            |
| **Select / DropdownMenu** (gatilho) | **Botão pop-up do macOS**: 28px, raio 8px, `--fill-2`, rótulo 500 + valor 400 (colorido quando tem significado) + ícone `ChevronsUpDown` de 12px. Conteúdo: vidro, itens de 30px, check verde.                                                                                                                                  |
| **Input / Textarea**                | Cápsula (input) ou raio 10px (textarea), fundo `rgba(0,0,0,.22)`, borda interna de 1px a 6%, foco com anel azul de 3px a 40%.                                                                                                                                                                                                   |
| **Switch**                          | Tamanho iOS (44×26), ligado em `--green` (ou `--purple` quando controla a IA), bolinha branca com sombra, deslize com mola.                                                                                                                                                                                                     |
| **Checkbox**                        | **Círculo** de 18px (seleção estilo Mail/Fotos), marcado em verde com check escuro.                                                                                                                                                                                                                                             |
| **Table**                           | Cartão agrupado; cabeçalho 34px em `11.5px` 500 `--text-tertiary`; linhas de 54px **alternadas** (`rgba(255,255,255,.018)` nas pares); hover `.04`; selecionada `green/11`.                                                                                                                                                     |
| **Sheet**                           | Painel flutuante inset (10px da borda), vidro, raio 16px, movimento da seção 4.7.                                                                                                                                                                                                                                               |
| **Dialog**                          | Mesmo material do sheet, centralizado, entra com `scale(.96)` + fade.                                                                                                                                                                                                                                                           |
| **Progress**                        | Trilho `--fill-2` de 6 a 8px, preenchimento em degradê da cor, cantos totalmente arredondados.                                                                                                                                                                                                                                  |
| **Switch de tema, Tooltip, Sonner** | Vidro escuro, raio 10px, 12.5px.                                                                                                                                                                                                                                                                                                |
| **Alert**                           | Banner: fundo `orange/11` sobre `--card`, borda interna `orange/24`, raio 16px, ícone-tile laranja, título 500 laranja + descrição 300 na linha de baixo, ação em cápsula `sm` à direita.                                                                                                                                       |

---

## 6. Componentes de apresentação novos (permitidos, em `src/components/`)

- `IconTile`: o quadrado colorido com ícone branco (tamanhos 22, 26, 30, 34px e 64px para cabeçalhos). Prop `color`.
- `Avatar`: círculo com iniciais (1 ou 2 letras), degradê da cor; cor escolhida por hash do nome entre blue, green, orange, purple, pink, teal.
- `StatusBadge`, `ScoreRing` (anel de 22px com o número ao lado, cor da faixa) e `ScoreRingLarge` (64px com número e faixa dentro, para o painel do lead).
- `ProgressRing` (anel com `--p` de 0 a 100, cor por prop) para a barra lateral e buscas.
- `GroupedList` e `GroupedRow` (com slots: ícone/avatar, título, subtítulo colorido, acessório à direita, seta `›` opcional, separador recuado).
- `MetricCard` (cartão de número com hover `.lift`).
- `Lift` (wrapper que aplica a elevação e o brilho que segue o cursor).
- `FloatingBar` (barra de vidro centralizada no rodapé do painel de conteúdo).
- `EmptyState` (ícone-tile de 64px cinza, título 16px 500, descrição 300, ações em cápsula).

---

## 7. Estrutura (`src/components/app-shell.tsx`)

### 7.1 Barra lateral (vidro)

- Largura 236px, flutuante (seção 4.6), modo recolhido com ícones mantido.
- **Topo:** marca de 30px (quadrado raio 9px, degradê verde, "N" em `#032D12` 600, sombra verde suave) + "Nelcota Leads" 13.5px 500 + "Prospecção B2B" 11.5px 300.
- **Campo "Nova busca":** 30px, raio 9px, `--fill-2`, ícone de lupa e texto `--text-tertiary`. Abre o `NewSearchDialog` existente. Sem atalho de teclado.
- **Grupos:** "Prospecção" (Visão geral, Leads, Conversas, Buscas) e "Sistema" (Configurações), com rótulo 11.5px 500 `--text-tertiary`.
- **Itens:** 32px, raio 9px, `IconTile` de 22px: Visão geral `blue`, Leads `green`, Conversas `orange`, Buscas `purple`, Configurações `gray`.
  - Inativo: ícone cinza, texto `--muted-foreground`. Hover: ícone colorido, fundo `rgba(255,255,255,.055)`. Ativo: ícone colorido, fundo `rgba(255,255,255,.12)`, texto principal.
  - Contadores à direita em 12px 500; o de "precisam de você" em Conversas vira **pílula laranja** (fundo laranja, texto escuro, 18px).
- **Rodapé:**
  - cartão de uso (`rgba(255,255,255,.045)`, raio 14px) com dois `ProgressRing` de 34px: "**12** de 30 · e-mails hoje" (verde) e "**8** de 50 · buscas no Google" (azul). Sem e-mail configurado: troque o anel de e-mail por "Conectar e-mail" em laranja;
  - linha da conta: avatar de 28px + endereço + "Caixa conectada" em verde com ponto;
  - o botão de tema vira um ícone discreto nessa linha.

### 7.2 Painel de conteúdo e barra superior (`Page`)

- O conteúdo fica num painel `--background` flutuante (raio 18px, borda interna de 1px a 7%, sombra grande).
- **Barra superior** de 64px dentro do painel, sem linha divisória: **título grande** da página (26px 500) à esquerda; à direita, as ações em cápsula ou num grupo de vidro (`.glass` do modelo: cápsula `rgba(118,118,128,.16)` contendo botões-ícone redondos de 30px). O `SidebarTrigger` vira um botão-ícone discreto à esquerda do título.
- **Linha de resumo** logo abaixo do título (prop `description`): 14px 300 `--muted-foreground`, números em 500, coloridos pela semântica e separados por " · ".
- Conteúdo com 26px de padding lateral, largura máxima de 1280px, 24px entre blocos, e a máscara de fade nas bordas de rolagem.
- Conversas usa uma variante de altura total sem padding (`bleed`).

---

## 8. Telas

### 8.1 Visão geral (`src/routes/index.tsx`)

**Resumo:** `{stats.leads} leads na base · {readyToSend} prontos para disparo (azul) · {attention.length} precisam de você (laranja)`. Omita o último quando for 0.

**Ordem (a mesma do app atual):**

1. **`SetupAlerts`:** banners (seção 5).
2. **"Precisa de você" (`Attention`):**
   - Título laranja + contador em etiqueta + legenda "A IA parou e passou para você" + link azul "Ver todas" à direita (leva a Conversas filtradas em "Precisa de você", filtro que já existe).
   - Lista agrupada: avatar de 32px, nome 500, motivo (`handoffReason`) em laranja 500, horário e seta `›`. No hover aparece o botão `sm` "Abrir conversa" (texto atual).
3. **`Stats`, 5 `MetricCard`** (5 colunas, 3 em telas médias, 2 no celular):
   - topo: `IconTile` de 22px + rótulo na cor (E-mails hoje `blue` `Send`; Responderam `green` `Reply`; IA conversando `purple` `Sparkles`; Interessados `orange` `Flame`; Descadastros `gray` `UserX`);
   - número 36px 500; legenda 12.5px 300 com o destaque na cor ("**40%** do limite de 30", "**18%** dos contatados");
   - brilho radial suave da cor no canto superior direito; hover `.lift` completo (seção 4.7);
   - **clique** leva a telas existentes: E-mails hoje e IA conversando → Conversas; Responderam e Interessados → Leads na aba "Em conversa"; Descadastros → Leads na aba "Todos".
4. **Funil + Modo automático** lado a lado (1.5fr / 1fr):
   - **Funil:** lista agrupada com 6 linhas horizontais: ponto + nome na cor (120px), barra de 8px com degradê da cor proporcional ao total (cresce da esquerda ao abrir), valor 500 e a % da etapa anterior em 11px na cor. Cores: Na base `gray`, Com e-mail `teal`, Contatados `blue`, Responderam `orange`, Interessados `purple`, Fechados `green`.
   - **Modo automático:** lista com 3 linhas (`IconTile` de 30px + título + legenda + switch): IA responde sozinha (`purple`, switch roxo), Disparo automático (`blue`), Busca diária (`green`). Abaixo, uma segunda lista com Fila de envio, IA no mês e Google no mês (valores à direita). "Buscar agora" e "Ajustar" viram cápsulas `sm` abaixo.
5. **Atividade de hoje:** lista agrupada; cada evento com `IconTile` de 30px na cor do tipo, nome da empresa em 500, verbo na cor na linha de baixo e horário à direita.

### 8.2 Leads (`src/routes/leads/index.tsx`)

**Resumo:** `{all} leads · {todo} a contatar (azul) · {pending} em análise (roxo)`.

1. **Barra superior:** à direita, um grupo de vidro com o campo "Buscar empresa" (o input atual, em cápsula) e outro grupo com dois botões-ícone: Exportar CSV (`Download`) e Busca manual (`Plus`), ambos com tooltip.
2. **Filas:** controle segmentado com todas as `LEAD_VIEWS`, contadores coloridos (Retornar hoje e Em conversa em laranja, Fechados em verde).
3. **Filtros:** botões pop-up do macOS: "Nota **Alta**" (valor colorido pela faixa), "Busca todas", "Sem site", "Com e-mail" (quando ativo: fundo `green/16`, texto verde e check). "Ordenar maior nota" alinhado à direita.
4. **Tabela:** seção 5. Colunas:
   - seleção (checkbox redondo);
   - Empresa: `Avatar` de 32px + nome 500 + dica 12px 300 ("Sem site" em laranja, "Lendo o site…" em roxo);
   - Nota: `ScoreRing` ou etiqueta roxa "analisando" com `Sparkles`;
   - E-mail ("sem e-mail" em `--text-tertiary`), Telefone, Google (estrela amarela + nota + `(n)` terciário).
   - Rodapé interno: "**38** leads · 4 em análise (roxo)" à esquerda e "J e K navegam no lead aberto" à direita.
5. **Seleção:** a faixa atual vira `FloatingBar` de vidro centralizada no rodapé (entra subindo com mola): "**3 selecionados**", aviso laranja "1 sem e-mail fica de fora", "Limpar" e "Disparar e-mail" (verde).
6. **Vazio:** `EmptyState` com `IconTile` `Inbox` e os textos e botões atuais.

### 8.3 Painel do lead (`lead-sheet.tsx` + `lead-detail.tsx`)

Sheet flutuante de 620px (seção 4.7).

1. **Barra:** grupo de vidro com setas anterior/próximo + "1 de 38" + teclas `K` `J` desenhadas; botão fechar redondo à direita.
2. **Cabeçalho:** avatar quadrado de 52px (raio 14px) + nome 21px 500 + fatos 300 (busca, cidade, estrela e nota do Google) + etiquetas (status, retorno, motivo do descarte em vermelho) + `ScoreRingLarge` à direita.
3. **`QuickActions`:** grade de até 5 botões no estilo do app Contatos: `IconTile` redondo de 34px + rótulo na cor (WhatsApp e Ligar `green`, Copiar `gray`, Site `blue`, Google Maps `red`). Mostre só os que existem hoje para o lead.
4. **`NextStep`:** cartão com faixa verde de 3px à esquerda. Cabeçalho com `IconTile` + título 14px 500 + descrição 300 e etiqueta roxa "Escrito pela IA" quando o texto é da IA. Campos (assunto, mensagem) em fundo `rgba(0,0,0,.22)`. Botões em cápsula: ação principal verde, "Gerar outro" com `Sparkles` roxo, "Descartar" à direita (fica vermelho no hover). Vale para as 5 variações (`EmailStep`, `FirstContactStep`, `WaitingStep`, `ConversationStep`, fechado e descartado); os botões de retorno ("Amanhã", "Em 3 dias"…) viram controle segmentado.
5. **Análise:** título roxo com `Sparkles`; cartão com o resumo em 14px; duas colunas "Oportunidades" (título e marcadores verdes) e "Dores prováveis" (laranja); "Como a nota foi calculada" com seta que gira 90° ao abrir.
6. **Contato + Notas** lado a lado: lista rótulo/valor (rótulo 300 à esquerda, valor 500 à direita, links azuis com `ArrowUpRight`) e notas num cartão que ganha borda no hover e no foco.
7. **Rodapé:** pop-up de status (valor colorido), metadados da análise em 11.5px 300 terciário e "Reanalisar" em cápsula com `RefreshCw` (girando enquanto analisa).

### 8.4 Revisão do disparo (`dispatch-sheet.tsx`)

Mesmo sheet.

1. **Cabeçalho:** "Disparar N e-mails" 17px 500 + descrição 300; fechar redondo. Enquanto a IA escreve, `Sparkles` roxo pulsando no título.
2. **Paginador:** grupo de vidro com setas + "1 de 2" + nome do lead + pontinhos de página à direita.
3. **Cartão de e-mail:** linhas "De" e "Para" (o "Para" é uma etiqueta com avatar de 16px), etiqueta "Escrito pela IA", assunto 17px 500 e corpo 14px com altura de linha 1.7. Assunto e corpo continuam editáveis.
4. "Gerar outro" (roxo) e "Tirar do disparo" (vermelho no hover) em cápsulas.
5. **"Ficaram de fora":** banner laranja com `IconTile`.
6. **Rodapé fixo:** lista com Envio, "Restam hoje **18** de 30" (número verde) e o switch roxo da IA; botão verde de largura total, 44px, "Disparar N e-mails".

### 8.5 Conversas (`src/routes/conversas.tsx`): estilo Apple Mail

Altura total, três colunas separadas por linhas de 0,5px: lista (330px), leitura (flexível), detalhes (290px, só a partir de ~1300px; abaixo disso, esconda). No celular, o comportamento atual se mantém.

1. **Barra superior:** título "Conversas" + botão-ícone de vidro "Verificar e-mails" (`RefreshCw`, girando durante a verificação, tooltip com o texto atual).
2. **Lista:** filtros em controle segmentado compacto (contadores coloridos). Itens com raio 12px, 8px de margem lateral:
   - ponto de 9px na cor do estado à esquerda para "Precisa de você" (como "não lido" do Mail), com o nome em 600;
   - nome + horário, prévia de 2 linhas 300, etiqueta de estado;
   - selecionado: fundo `blue/26` (destaque do Mail), separadores somem ao redor.
3. **Leitura:**
   - cabeçalho com avatar, nome, e-mail e a cápsula "IA no comando" (`Sparkles` + switch roxo);
   - assunto 22px 500;
   - mensagens em formato documento (largura máxima 68ch): avatar (IA = círculo com degradê roxo e `Sparkles`), autor (IA em roxo), "para …" 300, horário à direita, corpo 14px 1.7;
   - aviso "A IA parou: …" em banner laranja com `IconTile` `Hand`;
   - **compositor de vidro** preso na base (raio 18px): "Para" com etiqueta do e-mail, etiqueta roxa "Rascunho da IA" quando houver, área de texto, dica "A assinatura é adicionada no envio." à esquerda, "Devolver para a IA" (roxo, só em "Precisa de você") e "Enviar" (verde).
4. **Detalhes** (estilo cartão de contato): avatar de 56px centralizado, nome, etiquetas de estado e nota, botões redondos Ligar (verde) e Site (cinza) quando existirem; lista com Telefone, Site (azul) e Google; "Resumo da IA" com título roxo; lista de ações: "Ver análise completa" (azul, com `›`), "Marcar como fechado" (verde), "Encerrar sem negócio" (vermelho).
5. **Vazio:** `EmptyState` com `MessagesSquare`.

### 8.6 Buscas (`src/routes/searches/index.tsx`)

**Resumo:** `{n} buscas · {soma foundCount} leads novos (verde) · {em andamento} em andamento (roxo)`. O botão "Busca manual" vira cápsula verde com `Plus`.

Troque a tabela por **cartões de busca** (`.lift`, mesmos dados e ordem):

- **Cabeçalho:** `IconTile` de 30px (`Bot` roxo para automática, `Search` azul para manual) + "{nicho} em {cidade}" 14px 500 + etiqueta com a contagem ("24 leads") + linha "**Automática**/**Manual** (colorido) · data · N requisições" em 12px 300. À direita: etiqueta de status e "Ver leads" (se `foundCount > 0`).
- **Em andamento ou com falha:** três blocos lado a lado (`--fill-3`, raio 12px), um por passo:
  1. "Coleta no Google Maps": "**24** empresas novas · 16 já existiam";
  2. "Análise com IA": "**15** de 24 analisadas" + barra roxa;
  3. "Concluída" (ou a mensagem de erro em vermelho no passo que falhou).
     Ícone de cada passo: círculo de 20px (pendente: contorno; feito: verde com check; em andamento: anel roxo com o progresso; erro: vermelho com X). O título do passo atual vai na cor do status. No hover do cartão, os blocos clareiam.
- **Concluídas:** uma linha só: check verde + "**31** empresas novas · **31** analisadas · **29** já existiam" (erros em vermelho).
- **Vazio:** `EmptyState` com o texto e o botão atuais.

### 8.7 Nova busca (`new-search-dialog.tsx`)

Dialog de vidro de 560px. Nicho e Cidade numa **frase**: dois campos dentro de uma única barra, separados por "em" em `--text-tertiary` (rótulos visíveis acima, dicas e erros abaixo). "Quantas empresas" em controle segmentado. Linha "1 requisição ao Google · restam 49 de 50 hoje" em 12px 300. Aviso de oferta em banner laranja; bloqueio em banner vermelho. Rodapé: "Cancelar" e "Buscar empresas" (verde).

### 8.8 Configurações (`src/routes/settings.tsx`): estilo Ajustes do macOS

Coluna central de 720px.

1. **Cabeçalho:** `IconTile` cinza de 64px com `Settings` + "Como a IA trabalha por você" 18px 500 + descrição 300 (texto novo permitido, só descritivo).
2. **Cada seção:** título 16px 500 acima, lista agrupada, e a descrição atual vira **nota de rodapé** abaixo da lista (12px 300 terciário), como nos Ajustes. Âncoras `#email` e `#piloto` mantidas.
3. **E-mail:** uma linha com `IconTile` verde, o endereço e "Conectado · X de 30 enviados hoje" em verde (ou laranja quando não configurado) + "Testar conexão" em cápsula com `PlugZap`.
4. **Modo automático:** 3 linhas com switch (IA roxo, Disparo azul, Busca diária verde). Subseção "O que buscar": cada alvo é uma **frase** "[nicho] em [cidade]" com botão redondo vermelho de remover (`Minus`); "Adicionar nicho e cidade" com botão redondo verde e texto azul. Horário e Empresas por dia como linhas com pop-up à direita.
5. **Oferta e cliente ideal:** dois campos de texto dentro da lista, com rótulo acima. Se a oferta estiver vazia, a nota de rodapé fica laranja.
6. **Critérios de pontuação:** uma linha por critério com o sinal à esquerda e o peso num **stepper** (− valor +) à direita, valor verde se positivo e vermelho se negativo. O texto do sinal continua editável. "Soma dos positivos" no título da seção, em verde. "Adicionar critério" no padrão do item 4.
7. **Mensagem de abordagem:** Tom em controle segmentado; nota mínima em stepper; Seu nome e Sua empresa como campos à direita da linha.
8. **"Alterações não salvas":** `FloatingBar` de vidro com "Descartar" e "Salvar" (verde).

### 8.9 Estados gerais

- **Erro e 404:** `EmptyState` centralizado (`TriangleAlert` laranja, `Compass` cinza) com textos e botões atuais.
- **Carregamento:** skeletons no formato real (linhas agrupadas, cartões de número, linhas de tabela), com pulso de baixo contraste.
- **Foco de teclado:** anel azul (`--blue`) de 3px a 40% em todo controle; ordem de tabulação inalterada.

---

## 9. Responsividade e acessibilidade

- Testar em 1440×900, 1280×800, 1024×768, 768×1024 e 390×844. Sem rolagem horizontal da página.
- **Até 1180px:** cartões de número em 3 colunas; Funil e Modo automático empilhados; detalhes das Conversas escondidos.
- **Até 900px:** barra lateral de 200px; passos das buscas empilhados.
- **Até 720px:** a barra lateral vira sheet (como hoje); janela sem margens nem raios; cartões em 2 colunas; Conversas em um painel só; grupos de vidro da barra superior escondidos (ações vão para um menu).
- Contraste AA para texto principal e secundário; `--text-quaternary` só para elementos decorativos.
- A cor nunca é o único sinal (etiquetas sempre com texto).
- Respeitar `prefers-reduced-motion`, `prefers-reduced-transparency` e `prefers-contrast: more` (fundos sólidos e bordas visíveis).

---

## 10. Ordem de execução

Uma branch nova (ex.: `feat/visual-apple-pro`), **um commit por fase** (mensagens no padrão `caveman-commit`):

1. **Fundação:** tokens de cor, materiais, tipografia, raios, movimento, tema padrão escuro (seção 4).
2. **Componentes base** e componentes de apresentação (seções 5 e 6).
3. **Estrutura:** barra lateral de vidro, painel de conteúdo, barra superior e resumo (seção 7).
4. **Visão geral** (8.1).
5. **Leads**, **painel do lead** e **revisão do disparo** (8.2, 8.3, 8.4).
6. **Conversas** (8.5).
7. **Buscas** e **Nova busca** (8.6, 8.7).
8. **Configurações** e **estados gerais** (8.8, 8.9).

Ao fim de cada fase:

- `pnpm lint` e `pnpm test` passando, sem testes desabilitados.
- Rodar o app (`pnpm dev`) e comparar cada tela alterada **lado a lado com `docs/modelo-apple-pro.html`**, no escuro e no claro, em desktop e em 390px.
- Para ver tabelas e conversas com conteúdo, pode inserir dados fictícios **só no banco local** (`wrangler d1 execute nelcota-leads --local`). Nunca no remoto e nunca no commit.

---

## 11. Checklist de aceite

- [ ] Nenhum arquivo em `src/server`, `src/db`, `drizzle`, `src/lib/{ai,mail,places,scrape}`, `queries.ts` ou `schemas.ts` foi alterado.
- [ ] Nenhuma rota, query, mutação, filtro, integração, atalho ou dependência nova.
- [ ] O app abre no escuro sem preferência salva; o claro funciona.
- [ ] Barra lateral de vidro flutuante com ícones-tile (cinza no inativo, coloridos no ativo e no hover) e anéis de uso.
- [ ] Cores do sistema da Apple, aplicadas também ao texto, seguindo os mapeamentos das seções 4.2 e 4.3.
- [ ] Tudo que é da IA em roxo com `Sparkles` ou `Bot`.
- [ ] Manrope em toda a interface (300 a 600, nunca 700 ou 800) e números tabulares.
- [ ] Listas agrupadas com separadores recuados, botões em cápsula, controles segmentados e pop-ups do macOS.
- [ ] Hover dos cartões principais: elevação, brilho que segue o cursor, ícone e seta animados; `:active` em todo clicável.
- [ ] Anéis e barras animam ao abrir; sheets entram e saem pela direita com mola; tudo desligado com `prefers-reduced-motion`.
- [ ] Seleção de leads numa barra de vidro flutuante; Conversas no estilo Apple Mail; Buscas com passos; Configurações no estilo Ajustes.
- [ ] J/K, âncoras, parâmetros de URL, toasts e `aria-label`s funcionando como antes.
- [ ] `pnpm lint` e `pnpm test` verdes.
