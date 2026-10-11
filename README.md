# Nelcota Leads

Sistema de uso próprio para encontrar negócios locais e qualificá-los com IA.

1. Você informa nicho + cidade (ex.: "dentistas" em "Belo Horizonte").
2. O app busca as empresas no Google Places API (New).
3. Para cada empresa, uma fila (Cloudflare Queues) lê o site público, quando ele existe, e a DeepSeek gera um resumo, sinais de oportunidade, dores prováveis, uma nota de 0 a 100 com justificativa e uma mensagem de primeiro contato.
4. Os leads aparecem ordenados por nota, com filtros, status, notas, link do WhatsApp e exportação em CSV.

> O sistema não envia mensagens. Ele prepara o texto e o link `wa.me`, e o envio é sempre manual.

## Stack

TanStack Start (React 19) em Cloudflare Workers · D1 + Drizzle · Cloudflare Queues · Vercel AI SDK + `@ai-sdk/deepseek` · Tailwind v4 + shadcn/ui · TanStack Query/Table · oxlint/oxfmt · Vitest (`@cloudflare/vitest-plugin`) · lefthook · pnpm.

```
src/
  routes/            páginas (leads, detalhe, buscas, configurações) e /api/leads.csv
  server/            server functions, coleta, fila (consumer) e processamento por lead
  db/                schema Drizzle e cliente D1
  lib/places/        Google Places (Text Search, limite diário)
  lib/scrape/        leitura de site (robots.txt, linkedom)
  lib/ai/            prompts, analisador DeepSeek, custo
  server.ts          entry do Worker: fetch (app) + queue (consumer)
drizzle/             migrations SQL (aplicadas pelo wrangler)
```

## Rodando localmente

Requisitos: Node 22+ e pnpm.

```bash
pnpm install
cp .dev.vars.example .dev.vars     # preencha as duas chaves
pnpm db:migrate:local              # cria o banco D1 local
pnpm dev                           # http://localhost:3000
```

As duas chaves (`GOOGLE_PLACES_API_KEY` e `DEEPSEEK_API_KEY`) são obrigatórias: o app não usa dados simulados. Enquanto alguma faltar, a tela de nova busca mostra qual é e bloqueia a busca.

Fluxo de uso: Configurações (descreva sua oferta e os critérios) → Nova busca → acompanhe o progresso → Leads (abas por status, filtro por faixa de nota) → clique num lead para abrir o painel lateral → revise a mensagem, abra o WhatsApp e avance o status no funil → Exportar CSV.

### Variáveis

| Nome                         | Tipo                   | Descrição                                                                                                  |
| ---------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GOOGLE_PLACES_API_KEY`      | secret                 | Chave com a "Places API (New)" habilitada                                                                  |
| `DEEPSEEK_API_KEY`           | secret                 | Chave de platform.deepseek.com                                                                             |
| `AI_MODEL_ANALYSIS`          | var (`wrangler.jsonc`) | Modelo da análise e da nota. Padrão: `deepseek-flash`                                                      |
| `AI_MODEL_MESSAGE`           | var (`wrangler.jsonc`) | Modelo da mensagem. Padrão: `deepseek-v4-pro`                                                              |
| `PLACES_DAILY_REQUEST_LIMIT` | var (`wrangler.jsonc`) | Máximo de requisições pagas ao Google por dia (horário de Brasília). Padrão: `50`, até ~1.000 empresas/dia |

Os nomes `deepseek-chat` e `deepseek-reasoner` foram aposentados pela DeepSeek. `deepseek-v4-flash` ainda é aceito, mas a DeepSeek o considera um nome legado de `deepseek-flash`.

### Scripts

| Script                                        | O que faz                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                                    | servidor de desenvolvimento (Worker + D1 + Queues locais via Miniflare) |
| `pnpm build` / `pnpm deploy`                  | build e deploy na Cloudflare                                            |
| `pnpm lint`                                   | `oxlint --type-aware --type-check` (também checa os tipos)              |
| `pnpm fmt`                                    | `oxfmt`                                                                 |
| `pnpm test`                                   | testes unitários (Node) e de integração (runtime Workers com D1)        |
| `pnpm db:generate`                            | gera uma migration a partir de `src/db/schema.ts`                       |
| `pnpm db:migrate:local` / `db:migrate:remote` | aplica as migrations no D1 local / remoto                               |
| `pnpm cf-typegen`                             | regenera `worker-configuration.d.ts` após mudar o `wrangler.jsonc`      |

O `lefthook` roda formatação e lint em cada commit (é instalado pelo `pnpm install`).

## Deploy na Cloudflare

```bash
pnpm exec wrangler login

# 1. Banco D1: copie o "database_id" impresso para wrangler.jsonc (d1_databases[0].database_id)
pnpm exec wrangler d1 create nelcota-leads

# 2. Filas (principal + dead-letter)
pnpm exec wrangler queues create nelcota-leads-analysis
pnpm exec wrangler queues create nelcota-leads-analysis-dlq

# 3. Migrations no banco remoto
pnpm db:migrate:remote

# 4. Segredos (o valor é pedido no terminal; nunca vai para o repositório)
pnpm exec wrangler secret put GOOGLE_PLACES_API_KEY
pnpm exec wrangler secret put DEEPSEEK_API_KEY

# 5. Deploy
pnpm deploy
```

O deploy imprime a URL `*.workers.dev`. Proteja-a com Cloudflare Access antes de usar (próxima seção), pois o app não tem login próprio.

Plano: Queues está incluído no Workers Free (10 mil operações/dia, ≈ 3.300 leads/dia), mas o Free limita cada invocação a 10 ms de CPU, e ler HTML de sites grandes pode passar disso. Para uso real, recomendo o Workers Paid (US$ 5/mês).

### Proteger o painel com Cloudflare Access

1. No painel da Cloudflare, abra Zero Trust → Access → Applications → Add an application → Self-hosted.
2. Em Application domain, informe o domínio do Worker (`nelcota-leads.<sua-conta>.workers.dev` ou um domínio próprio ligado ao Worker em _Workers → Settings → Domains & Routes_).
3. Crie uma policy com Action Allow e regra Emails contendo apenas o seu e-mail. O método de login pode ser _One-time PIN_ por e-mail ou Google.
4. Salve e abra a URL em uma janela anônima: deve aparecer a tela de login do Access.
5. Opcional: em _Workers → nelcota-leads → Settings → Domains & Routes_, desative a URL `workers.dev` se usar domínio próprio, para não deixar uma porta sem Access.

Tudo fica atrás do Access: páginas, server functions e `/api/leads.csv`. O consumer da fila não recebe tráfego HTTP.

## Como funciona

- Coleta (`src/server/collect.ts`): `places:searchText` com `X-Goog-FieldMask` mínimo e paginação (`nextPageToken`, 20 por página, máximo 60). Negócios que não estão `OPERATIONAL` são ignorados. Telefones são normalizados para E.164 com `libphonenumber-js`. Cada lead é único por `place_id`: lugares já vistos em buscas anteriores não são gravados de novo nem reanalisados. A busca registra quantos já existiam.
- Fila (`src/server/consumer.ts`): uma mensagem por lead. Uma falha temporária gera retry com backoff exponencial (30s, 60s). Após 3 tentativas o erro fica registrado no lead e a busca segue. Mensagens que esgotarem os retries da própria fila caem na DLQ, que também marca o lead. Por isso nenhuma busca fica presa em "analisando".
- Idempotência (`src/server/process-lead.ts`): um lead já analisado é ignorado. Só o botão Reanalisar força uma nova análise, que fica no histórico (`analyses`) sem inflar os contadores da busca.
- Leitura do site (`src/lib/scrape`): `fetch` com `AbortSignal.timeout`, User-Agent identificável (`NelcotaLeadsBot/1.0`), respeito ao `robots.txt` (RFC 9309) e limite de 1,5 MB. Extrai título, meta description, texto (truncado em 8.000 caracteres), links de redes sociais, e-mails e telefones comerciais do próprio site. Se o site falhar, o lead fica `unreachable` e segue só com os dados do Google.
- IA (`src/lib/ai`): `generateText` + `Output.object` com schemas `zod`. O modo _thinking_ da V4 fica desligado porque encarece sem ganho para esta tarefa. O prompt manda usar somente os dados fornecidos, proíbe inventar contatos, pessoas ou fatos e trata o texto do site como não confiável (defesa contra _prompt injection_). A IA nunca se passa por cliente. Sem a oferta descrita nas Configurações ela não escreve mensagens, porque não teria o que oferecer. Cada análise grava modelo, tokens e custo estimado, e o gasto do dia fica em `api_usage` para o painel mostrar o custo do mês.
- Triagem (`src/server/process-lead.ts`): leads novos com nota abaixo do mínimo (30 por padrão) são descartados pela IA, com o motivo gravado, e não recebem mensagem. Os demais recebem a mensagem pronta. A IA nunca descarta um lead que você já contatou, e um lead descartado volta para a fila se uma nova análise passar do mínimo.
- Piloto automático (`src/server/autopilot.ts`): um Cron Trigger roda de hora em hora. Uma vez por dia, a partir do horário escolhido, ele busca cada nicho e cidade cadastrados. A primeira busca usa a cidade inteira; as seguintes percorrem bairros sugeridos pela IA, porque o Google devolve os mesmos 60 primeiros resultados para a mesma busca. Para quando o limite diário do Google acaba.
- Retornos (`src/server/follow-ups.ts`): a cada hora, a IA escreve um lembrete curto para cada lead contatado cujo dia de retorno chegou. O envio de tudo continua sendo um toque seu no WhatsApp.
- Painel (`src/routes/index.tsx`): mensagens prontas para enviar, retornos do dia, o que a IA fez hoje, funil e custo do mês. Enviar marca o lead como contatado e agenda o retorno em 3 dias, com opção de desfazer.
- Lista de leads (`src/routes/leads/index.tsx`): os leads ficam em filas (A contatar, Retornar hoje, Aguardando resposta, Em conversa, Fechados, Descartados). Ao marcar um lead como contatado, o app grava a data e agenda o retorno (3 dias por padrão, ajustável). No dia do retorno ele aparece em "Retornar hoje" e o menu mostra quantos são. J e K navegam entre os leads e / vai para a busca.
- Progresso: o painel, a lista e o lead aberto fazem polling (3 s) enquanto há análise pendente.
- Testar o piloto localmente: com `pnpm dev` rodando, `curl "http://localhost:3000/cdn-cgi/handler/scheduled"` dispara uma rodada. O botão Buscar agora, no painel, faz o mesmo ignorando o horário.
- CSV: `/api/leads.csv` aplica os mesmos filtros da tela. Usa `;` e BOM UTF-8 para abrir direto no Excel em português, e neutraliza fórmulas (proteção contra _CSV injection_).

## Custos estimados (outubro de 2026)

Google Places, SKU Text Search Enterprise. Os campos telefone, site, nota e avaliações colocam a requisição nesse SKU.

- US$ 35 por 1.000 requisições, com 1.000 requisições grátis por mês.
- Uma requisição devolve até 20 resultados. Uma busca de 60 resultados custa 3 requisições ≈ US$ 0,105, ou ≈ US$ 0,00175 por lead.
- A cota grátis cobre até ~20 mil resultados por mês.

DeepSeek. Preço de pico por 1M de tokens; fora do pico custa metade.

| Etapa                         | Modelo                                           | Tokens típicos              | Custo por lead |
| ----------------------------- | ------------------------------------------------ | --------------------------- | -------------- |
| Análise e nota                | `deepseek-flash` (US$ 0,30 entrada / 1,20 saída) | ~3.500 entrada + ~400 saída | ≈ US$ 0,0015   |
| Mensagem (só acima do limite) | `deepseek-v4-pro` (US$ 1,32 / 3,96)              | ~900 entrada + ~200 saída   | ≈ US$ 0,002    |

Total: ≈ US$ 0,003 a 0,005 por lead (Google + IA), ou cerca de US$ 0,20 a 0,30 por busca de 60 leads. O custo real de IA de cada análise aparece na página do lead. Os preços estão em `src/lib/ai/pricing.ts`; atualize-os se a DeepSeek mudar a tabela.

## LGPD e termos de uso

- Dados coletados: apenas de pessoas jurídicas e contatos comerciais públicos, ou seja, o perfil do Google e o próprio site da empresa. Não há scraping de redes sociais nem de perfis pessoais. As redes sociais só aparecem como links publicados pelo próprio site.
- Base legal: legítimo interesse (art. 7º, IX, e art. 10 da LGPD) para uma oferta B2B relacionada à atividade da empresa. Mantenha o registro do motivo de cada contato (campo _notas_) e trate só o necessário.
- Opt-out: toda mensagem sugerida termina com uma linha simples de descadastro. Quem pedir para sair deve ser marcado como Descartado e não ser contatado de novo.
- Volume controlado: o envio é manual, um a um. Não use o sistema para disparo em massa. Isso também viola as políticas do WhatsApp e pode bloquear o seu número.
- Google Places: os [termos da Google Maps Platform](https://cloud.google.com/maps-platform/terms) restringem armazenar e reutilizar conteúdo do Places. O `place_id` pode ser guardado indefinidamente; os demais campos devem ser usados como cache temporário (a política atual fala em até 30 dias) e atualizados ou descartados depois. Não revenda nem republique os dados e mantenha a atribuição ao Google quando exibi-los.
- Sites: o leitor se identifica pelo User-Agent, respeita `robots.txt` e lê uma página por empresa.

## Melhorias futuras

- Browser Rendering da Cloudflare para sites que só renderizam com JavaScript.
- Cloudflare Workflows para orquestrar coleta → leitura → análise com etapas persistentes.
- Rotina que apaga ou renova os dados do Places com mais de 30 dias (`scheduled` no `src/server.ts`).
- Botão "regenerar só a mensagem" e reanálise em lote.
