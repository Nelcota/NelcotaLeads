# Nelcota Leads

Sistema de uso próprio para encontrar negócios locais e qualificá-los com IA.

1. Você informa nicho + cidade (ex.: "dentistas" em "Belo Horizonte").
2. O app busca as empresas no Google Places API (New).
3. Para cada empresa, uma fila (Cloudflare Queues) lê o site público, quando ele existe, e a DeepSeek gera um resumo, sinais de oportunidade, dores prováveis e uma nota de 0 a 100 com justificativa. Leads abaixo da nota mínima são descartados.
4. Você seleciona os leads e dispara: a IA escreve um e-mail para cada empresa, você revisa e eles saem da sua caixa, espaçados, até 30 por dia.
5. Quando a empresa responde, a IA conversa sozinha até haver interesse (preço, reunião, proposta) e então passa a conversa para você.

> E-mail é o único canal automático. O WhatsApp continua manual: o app prepara o texto e o link `wa.me`.

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
cp .dev.vars.example .dev.vars     # preencha as chaves e a APP_PASSWORD
pnpm db:migrate:local              # cria o banco D1 local
pnpm dev                           # http://localhost:3000
```

O app inteiro fica atrás de uma tela de login com contas locais (e-mail e senha, guardadas no D1 com hash PBKDF2). Defina `APP_PASSWORD` (8+ caracteres) no `.dev.vars` e, em produção, com `wrangler secret put APP_PASSWORD`: ele é o **código de acesso** pedido para criar uma conta (`/criar-conta`) ou redefinir a senha (`/redefinir-senha`), e também a chave que assina as sessões. Na primeira vez, abra `/criar-conta` e use esse código. Para ter uma conta local sem passar pela tela, rode `pnpm account:seed --new --name "Seu nome" --email voce@empresa.com.br`: ele grava `account.local` (ignorado pelo Git) com uma senha aleatória e cria a conta no D1 local; depois, `pnpm account:seed` recria ou atualiza essa conta em qualquer banco local novo (`--persist-to` escolhe outro). A sessão dura 30 dias; redefinir a senha desconecta os outros navegadores daquela conta, e trocar o `APP_PASSWORD` desconecta todos. Cada IP tem até 10 tentativas erradas por dia (senha ou código).

As chaves `GOOGLE_PLACES_API_KEY` e `DEEPSEEK_API_KEY` são obrigatórias: o app não usa dados simulados. `MAIL_ADDRESS` e `MAIL_PASSWORD` são necessárias para disparar e-mails; teste a conexão em Configurações. Enquanto alguma faltar, a tela de nova busca mostra qual é e bloqueia a busca.

Fluxo de uso: Configurações (oferta, critérios, e-mail e modo automático) → Buscar empresas (ou busca diária automática) → Leads: selecione e clique em Disparar e-mail → revise os e-mails escritos pela IA → Disparar → acompanhe em Conversas; quando a IA para, a conversa aparece em "Precisa de você".

### Variáveis

| Nome                         | Tipo                   | Descrição                                                                                                  |
| ---------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GOOGLE_PLACES_API_KEY`      | secret                 | Chave com a "Places API (New)" habilitada                                                                  |
| `DEEPSEEK_API_KEY`           | secret                 | Chave de platform.deepseek.com                                                                             |
| `AI_MODEL_ANALYSIS`          | var (`wrangler.jsonc`) | Modelo da análise e da nota. Padrão: `deepseek-flash`                                                      |
| `AI_MODEL_MESSAGE`           | var (`wrangler.jsonc`) | Modelo da mensagem. Padrão: `deepseek-v4-pro`                                                              |
| `PLACES_DAILY_REQUEST_LIMIT` | var (`wrangler.jsonc`) | Máximo de requisições pagas ao Google por dia (horário de Brasília). Padrão: `50`, até ~1.000 empresas/dia |
| `MAIL_ADDRESS`               | secret                 | Endereço da caixa que envia e recebe (ex.: a sua caixa da Hostinger)                                       |
| `MAIL_PASSWORD`              | secret                 | Senha dessa caixa                                                                                          |
| `SMTP_HOST` / `SMTP_PORT`    | var (`wrangler.jsonc`) | Servidor de envio, TLS implícito. Padrão: `smtp.hostinger.com` / `465`                                     |
| `IMAP_HOST` / `IMAP_PORT`    | var (`wrangler.jsonc`) | Servidor de leitura, TLS implícito. Padrão: `imap.hostinger.com` / `993`                                   |
| `MAIL_DAILY_LIMIT`           | var (`wrangler.jsonc`) | Máximo de e-mails por dia, respostas incluídas. Padrão: `30`                                               |

Os nomes `deepseek-chat` e `deepseek-reasoner` foram aposentados pela DeepSeek. `deepseek-v4-flash` ainda é aceito, mas a DeepSeek o considera um nome legado de `deepseek-flash`.

### Scripts

| Script                                        | O que faz                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`                                    | servidor de desenvolvimento (Worker + D1 + Queues locais via Miniflare)   |
| `pnpm build` / `pnpm deploy`                  | build e deploy na Cloudflare                                              |
| `pnpm lint`                                   | `oxlint --type-aware --type-check` (também checa os tipos)                |
| `pnpm fmt`                                    | `oxfmt`                                                                   |
| `pnpm test`                                   | testes unitários (Node) e de integração (runtime Workers com D1)          |
| `pnpm test:e2e`                               | testes ponta a ponta (Playwright) com Google, DeepSeek e e-mail simulados |
| `pnpm db:generate`                            | gera uma migration a partir de `src/db/schema.ts`                         |
| `pnpm db:migrate:local` / `db:migrate:remote` | aplica as migrations no D1 local / remoto                                 |
| `pnpm cf-typegen`                             | regenera `worker-configuration.d.ts` após mudar o `wrangler.jsonc`        |

O `lefthook` roda formatação e lint em cada commit (é instalado pelo `pnpm install`).

Os testes E2E sobem o app com `E2E=1 vite dev` na porta 3100. Nesse modo, Google Places, DeepSeek e a caixa de e-mail são trocados por versões em memória, e o banco D1 fica separado em `.wrangler/e2e`. O seu `.dev.vars` não é usado (o código de acesso de teste é `e2e-password`, e o setup cria a conta `e2e@nelcota.test`). Para rodar uma segunda suíte ao lado de outra, use `E2E_PORT=3105 pnpm test:e2e`. Esse modo só existe no servidor de desenvolvimento: o build de produção não inclui os simuladores nem a rota `/api/e2e`.

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
pnpm exec wrangler secret put MAIL_ADDRESS
pnpm exec wrangler secret put MAIL_PASSWORD

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
- Triagem (`src/server/process-lead.ts`): leads novos com nota abaixo do mínimo (30 por padrão) são descartados pela IA, com o motivo gravado. O e-mail de cada lead é gravado a partir do site. A IA nunca descarta um lead que você já contatou, e um lead descartado volta para a fila se uma nova análise passar do mínimo.
- Piloto automático (`src/server/autopilot.ts`): um Cron Trigger roda de hora em hora. Uma vez por dia, a partir do horário escolhido, ele busca cada nicho e cidade cadastrados. A primeira busca usa a cidade inteira; as seguintes percorrem bairros sugeridos pela IA, porque o Google devolve os mesmos 60 primeiros resultados para a mesma busca. Para quando o limite diário do Google acaba.
- E-mail (`src/lib/mail`): cliente SMTP e IMAP próprio sobre os sockets TCP do Worker (`cloudflare:sockets`), com TLS implícito. Mensagens em texto simples UTF-8, `Message-ID` próprio, `In-Reply-To`/`References` para manter a conversa no mesmo fio e `List-Unsubscribe`. A leitura usa `BODY.PEEK`, então nada é marcado como lido na sua caixa, e começa do momento da conexão (não importa a caixa antiga).
- Disparo (`src/server/mail-flow.ts`): a IA escreve um rascunho por lead; o texto passa por uma verificação de vícios (cargo inventado, "faz sentido", elogio à nota do Google) e é reescrito uma vez se algum aparecer. Na fila, sai um e-mail a cada 8 minutos, dentro do limite diário. Todo primeiro contato termina com a linha de descadastro.
- Conversa (`handleInbound`): a cada 5 minutos o app lê as respostas e casa cada uma com o lead pelo `In-Reply-To` (ou pelo remetente). Respostas automáticas (férias, devoluções) são guardadas e ignoradas. "sair" descadastra na hora e cancela o que estiver na fila. Nos demais casos a IA decide: responder (dúvida simples sobre a oferta), passar para você (interesse, preço, reunião, pergunta que a oferta não responde, ou se perguntarem se é robô) com um rascunho, ou encerrar (sem interesse). Ela responde no máximo 3 vezes e nunca inventa preço, prazo ou funcionalidade.
- Lembrete: sem resposta em 3 dias, sai um único lembrete curto no mesmo fio.
- Agendador (`src/server/tick.ts`): um Cron Trigger por minuto envia o próximo e-mail da fila; a cada 5 minutos lê respostas e enfileira lembretes; na hora cheia roda a busca diária e o disparo automático (se ligado).
- Telas: Visão geral (o que precisa de você, números, funil, atividade e interruptores do modo automático), Leads (seleção e disparo), Conversas (caixa de entrada com o fio de cada empresa e o controle "IA no comando").
- Lista de leads (`src/routes/leads/index.tsx`): os leads ficam em filas (A contatar, Retornar hoje, Aguardando resposta, Em conversa, Fechados, Descartados). Ao marcar um lead como contatado, o app grava a data e agenda o retorno (3 dias por padrão, ajustável). No dia do retorno ele aparece em "Retornar hoje" e o menu mostra quantos são. J e K navegam entre os leads e / vai para a busca.
- Progresso: o painel, a lista e o lead aberto fazem polling (3 s) enquanto há análise pendente.
- Testar localmente: o cron não roda sozinho no `pnpm dev`. Use `curl "http://localhost:3000/cdn-cgi/handler/scheduled"` para uma rodada, o botão Verificar e-mails em Conversas e Buscar agora na Visão geral.
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
- Opt-out: todo primeiro e-mail e todo lembrete terminam com a linha de descadastro e o cabeçalho `List-Unsubscribe`. Quem responde "sair" é descadastrado automaticamente, nunca mais recebe e sai de todas as filas.
- Volume controlado: até 30 e-mails por dia, um a cada 8 minutos, sempre personalizados e enviados da sua própria caixa. Não aumente muito o limite: e-mail frio em volume derruba a reputação do domínio. Serviços transacionais (Cloudflare Email Service, Resend) proíbem prospecção e não são usados.
- WhatsApp: continua manual, um a um. Disparo automático por WhatsApp para contatos que não pediram viola as políticas do WhatsApp e bloqueia o número.
- Google Places: os [termos da Google Maps Platform](https://cloud.google.com/maps-platform/terms) restringem armazenar e reutilizar conteúdo do Places. O `place_id` pode ser guardado indefinidamente; os demais campos devem ser usados como cache temporário (a política atual fala em até 30 dias) e atualizados ou descartados depois. Não revenda nem republique os dados e mantenha a atribuição ao Google quando exibi-los.
- Sites: o leitor se identifica pelo User-Agent, respeita `robots.txt` e lê uma página por empresa.

## Melhorias futuras

- Browser Rendering da Cloudflare para sites que só renderizam com JavaScript.
- Cloudflare Workflows para orquestrar coleta → leitura → análise com etapas persistentes.
- Rotina que apaga ou renova os dados do Places com mais de 30 dias (`scheduled` no `src/server.ts`).
- Botão "regenerar só a mensagem" e reanálise em lote.
