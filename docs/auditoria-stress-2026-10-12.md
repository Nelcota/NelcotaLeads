# Auditoria: stress test, clique em tudo e desempenho

**Data:** 12/10/2026
**Versão testada:** branch `feat/ux-gaps`.

- A carga e a segunda rodada de cliques usaram o commit `618110f` (Sprints 1, 2 e 3 + contas locais).
- A primeira rodada de cliques e as medições no navegador usaram o commit `385a3ca` (Sprints 1, 2 + contas + o primeiro item do Sprint 3).

**Veredito:** o app ficou **estável** em todos os testes:

- 0 erros de servidor em cerca de 8 mil requisições;
- 0 erros de JavaScript ou de console em 541 cliques.

Os pontos fracos não são falhas, mas três riscos:

- o bloqueio de senha também tranca o dono do app;
- o primeiro carregamento no celular é pesado;
- o custo de processamento por página pode não caber no plano gratuito da Cloudflare.

---

## 1. Como foi testado

| Teste                       | Ambiente                                                                                               | Dados                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carga (stress)**          | Build de produção (`vite preview`, workerd local), porta 3006                                          | Cópia do seu banco local (7 leads, conversas reais de exemplo), logado com a sua conta                                                            |
| **Clique em tudo**          | Modo de teste do projeto (`E2E=1`), porta 3005: Google, DeepSeek e e-mail **simulados**, banco isolado | 6 leads em estados diferentes (com e sem e-mail, com nome e site hostis), 3 e-mails enviados, 2 respostas (uma pedindo preço, uma neutra), buscas |
| **Desempenho no navegador** | Build de produção, Chromium                                                                            | Desktop 1440 px; celular 390 px com 3G simulado (1,6 Mbps, 150 ms) e CPU 4x mais lenta                                                            |

**Limites desta auditoria:**

- **Servidor único:** é um único processo local. Em produção a Cloudflare distribui as requisições entre muitas instâncias, então a latência sob concorrência alta aqui é **pior** que a real. Só o tempo por requisição isolada (concorrência 1) é comparável.
- **Sem compressão local:** o servidor de teste não comprime os arquivos, e a Cloudflare comprime. A seção 3.3 traz as duas medidas.
- **Sem serviços reais:** nenhum serviço externo real foi chamado, nenhum e-mail saiu e nenhum crédito foi gasto.
- **Sem auditoria de acessibilidade completa:** não foi feita com axe, porque isso exigiria uma dependência nova.

---

## 2. Estabilidade

### 2.1 Carga (build de produção)

| Cenário                        |     Concorrência |           Requisições |  Req/s |                         p50 |                         p95 | Erros |
| ------------------------------ | ---------------: | --------------------: | -----: | --------------------------: | --------------------------: | ----: |
| Visão geral                    |               10 |                   102 |   19,5 |                      514 ms |                      651 ms |     0 |
| Leads                          |               10 |                   200 |   39,7 |                      247 ms |                      308 ms |     0 |
| Conversas                      |               10 |                   270 |   53,6 |                      182 ms |                      227 ms |     0 |
| Buscas                         |               10 |                   330 |   64,7 |                      151 ms |                      189 ms |     0 |
| Conta                          |               10 |                   190 |   37,5 |                      263 ms |                      341 ms |     0 |
| Configurações                  |               10 |                   140 |   27,0 |                      356 ms |                      497 ms |     0 |
| Exportar CSV                   |               10 |                   470 |   91,9 |                      106 ms |                      142 ms |     0 |
| Tela de login (pública)        |               10 |                   796 |  198,8 |                       46 ms |                       70 ms |     0 |
| Página sem login → redireciona |               10 |                 1.389 |  345,6 |                       27 ms |                       39 ms |     0 |
| Visão geral, rampa             | 1 / 10 / 25 / 50 | 126 / 142 / 160 / 175 | ~21–23 | 44 / 430 / 1.083 / 2.200 ms | 60 / 531 / 1.599 / 3.351 ms |     0 |
| 6 páginas misturadas           |               30 |                   383 |   36,2 |                      900 ms |                    1.160 ms |     0 |

**Leitura:**

- **Nenhum erro 500, nenhuma requisição perdida.** Somando as duas rodadas (`385a3ca` e `618110f`), foram cerca de 8 mil requisições.
- **A vazão fica parada em ~21 req/s na Visão geral** com qualquer concorrência. Cada requisição gasta ~45 ms de processamento, e o servidor local as atende uma de cada vez. Em produção cada requisição roda em paralelo; o número que importa é os **~45 ms por página da Visão geral**.
- **A Visão geral é a página mais cara:** ~3,4x a de Buscas.
- **O pior p95 vem só da fila:** 3,3 s com 50 simultâneos, efeito de um único processo local, não do código.

### 2.2 Clique em tudo (simulação de usuário)

Um robô abriu cada tela, listou todo elemento clicável (botões, links, abas, chaves, caixas de seleção, menus) e clicou em cada um a partir da página recém-carregada. Quando o clique abria um painel, diálogo ou menu, ele clicava também em tudo lá dentro. No fim, saiu da conta.

| Rodada                           | Telas                                                                                                      | Cliques | Erros JS / console | Erros HTTP |                          Falhas de clique |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------: | -----------------: | ---------: | ----------------------------------------: |
| 1 (`385a3ca`)                    | Visão geral, Leads, painel do lead (2 leads), Conversas, 2 conversas abertas, Buscas, Conta, Configurações |     325 |              **0** |      **0** | 25 → **todas falsos positivos** (seção 5) |
| 2 (`618110f`, telas do Sprint 3) | Visão geral, Conversas, 2 conversas abertas, Configurações                                                 |     216 |              **0** |      **0** |         1 → chave desativada de propósito |

**Ações que funcionaram, com o retorno certo:**

- encerrar com "Desfazer";
- "Escrever com IA" e "Reescrever" com "Desfazer";
- enviar ("Enviado");
- verificar e-mails ("Nenhuma resposta nova");
- testar conexão ("Conexão funcionando");
- exportar CSV (download);
- busca manual (diálogo);
- tema claro/escuro;
- sair (a página seguinte pediu login de novo).

**Dados hostis:** o lead com nome `<b>Nome</b> "esquisito" & ç` e site `javascript:alert(1)` foi exibido como texto e não executou nada, sem nenhum diálogo nativo.

---

## 3. Desempenho no navegador

### 3.1 Desktop (1440 px)

| Página        | Cache         |    1º byte | Conteúdo principal (LCP) |    Carregado | Saltos de layout (CLS) | Bloqueio (TBT) | Requisições |
| ------------- | ------------- | ---------: | -----------------------: | -----------: | ---------------------: | -------------: | ----------: |
| Login         | vazio         |      15 ms |                    92 ms |       126 ms |                      0 |              0 |          13 |
| Visão geral   | vazio / cheio | 69 / 47 ms |             356 / 264 ms | 399 / 208 ms |                  0,008 |              0 |          22 |
| Leads         | vazio / cheio | 37 / 35 ms |             208 / 112 ms | 183 / 114 ms |                  0,006 |              0 |          25 |
| Conversas     | vazio / cheio | 24 / 32 ms |               88 / 92 ms | 118 / 123 ms |                  0,002 |              0 |          22 |
| Buscas        | vazio / cheio | 18 / 24 ms |             120 / 124 ms | 120 / 102 ms |                  0,003 |              0 |          21 |
| Conta         | vazio / cheio | 47 / 46 ms |             140 / 160 ms | 131 / 162 ms |                      0 |              0 |          15 |
| Configurações | vazio / cheio | 45 / 38 ms |             184 / 188 ms | 155 / 151 ms |                      0 |              0 |          22 |

Navegação entre telas, sem recarregar a página: 77 a 126 ms.

### 3.2 Celular (390 px, 3G, CPU 4x mais lenta, **sem compressão**)

| Página        | Cache         |                 LCP |     Carregado |   CLS |          TBT |
| ------------- | ------------- | ------------------: | ------------: | ----: | -----------: |
| Login         | vazio         |          **3,67 s** |        5,41 s |     0 |       239 ms |
| Visão geral   | vazio / cheio | **3,88 s** / 0,49 s | 5,38 / 0,77 s | 0,042 |  27 / 110 ms |
| Leads         | vazio / cheio | **4,36 s** / 0,47 s | 5,82 / 0,81 s | 0,015 | 142 / 125 ms |
| Conversas     | vazio / cheio | **3,76 s** / 0,52 s | 5,40 / 0,77 s | 0,001 |  96 / 111 ms |
| Configurações | vazio / cheio | **4,14 s** / 0,67 s | 5,58 / 0,89 s |     0 | 348 / 204 ms |

Do clique em "Entrar" até o painel aparecer: 1,74 s.

### 3.3 Peso dos arquivos

| Item                                                          | Sem compressão |    Com gzip (como a Cloudflare serve) |
| ------------------------------------------------------------- | -------------: | ------------------------------------: |
| JavaScript + CSS do app                                       |        1,11 MB |                           **~345 KB** |
| Maior pedaço (app-shell)                                      |         305 KB |                                 97 KB |
| CSS                                                           |         157 KB |                                 37 KB |
| Fontes Manrope (só os pesos e o alfabeto usados são baixados) |         ~70 KB |                                ~70 KB |
| Worker (servidor)                                             |        1,13 MB | 253 KB (limite: 3 MB no plano grátis) |

Com a compressão de produção, a primeira visita no 3G deve cair de ~4 s para **~2 a 2,5 s**. É uma estimativa pelo tamanho; não foi medida.

---

## 4. Segurança verificada sob carga

| Verificação                                    | Resultado                                                                                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Páginas e CSV sem login                        | 303 para o login, e o CSV responde 401                                                                                            |
| Cabeçalhos de segurança                        | CSP (frame-ancestors, object-src, base-uri, form-action), `X-Frame-Options: DENY`, `nosniff` e `Referrer-Policy`, todos presentes |
| Cookie de sessão                               | `HttpOnly`, `Secure`, `SameSite=Lax`, prefixo `__Host-`                                                                           |
| 40 senhas erradas em paralelo                  | Exatamente 10 avaliadas e 30 recusadas com 429. A reserva atômica segura rajadas.                                                 |
| Dependências de produção (`pnpm audit --prod`) | Nenhuma vulnerabilidade conhecida                                                                                                 |

---

## 5. Falsos positivos descartados

As 25 "falhas de clique" da rodada 1 foram investigadas uma a uma:

| Registro                                                      | Causa                                                              | Conferido como                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 23 botões do painel do lead aberto por link (`/leads?lead=…`) | O robô clicou com 0,5 s, enquanto o painel ainda deslizava         | Repetido com a animação concluída: "Fechar", "Copiar telefone" e "Reanalisar" funcionam. Na rodada 2, com espera maior, não houve nenhum. |
| "Próximo lead (J)" no painel por link                         | O lead aberto não estava na lista filtrada, então não há "próximo" | Comportamento esperado                                                                                                                    |
| Chave "Busca diária" na Visão geral                           | Desativada porque não há nichos configurados                       | Esperado. Falta a dica do motivo (item A13 do Sprint 5)                                                                                   |
| "Não foi possível copiar"                                     | O robô roda sem permissão de área de transferência                 | Com permissão, copia. Sem ela, o app avisa em vez de falhar calado.                                                                       |

---

## 6. Pontos positivos

1. **Estabilidade total:** nenhum erro de servidor, de JavaScript ou de console em toda a bateria.
2. **Interface rápida no desktop:** todas as telas aparecem em menos de 400 ms com cache vazio e trocam de tela em ~100 ms. O layout não pula (CLS ≤ 0,008, muito abaixo do limite de 0,1) e não há travamentos (TBT 0).
3. **Com cache, rápido até no celular lento:** ~0,5 s para aparecer no 3G com CPU 4x mais lenta.
4. **Proteções funcionando sob pressão:** login obrigatório, CSRF, cabeçalhos, limite de tentativas atômico, dados hostis exibidos como texto.
5. **As ações do Sprint 1 seguram uso agressivo:** clicar em tudo, inclusive encerrar, reenviar e enviar, não gerou estado quebrado. Os botões que somem depois de encerrar uma conversa somem por design.
6. **Os retornos ao usuário existem:** toda ação testada mostrou o resultado (aviso, Desfazer, download ou navegação).
7. **Dependências limpas e Worker leve** (253 KB comprimido).

---

## 7. Pontos negativos e riscos, por prioridade

| #   | Prioridade                 | Achado                                                                                                                                                                                                                                                                                                                                                             | Evidência                                                                                                                            | Recomendação                                                                                                                                                                     |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Alta** · ✅ corrigido    | **O limite de tentativas tranca o dono.** Depois de 10 erros no mesmo IP, até a **senha certa** é recusada pelo resto do dia. Pior: o teto global de 100 erros por dia vale para **todos os IPs juntos**, então qualquer pessoa com ~100 endereços pode impedir todo mundo de entrar até o dia seguinte.                                                           | Teste 4: depois de 40 tentativas erradas, a senha certa recebeu 429. Código em `src/server/auth.ts` (`LOGIN_DAILY_FAILURES_TOTAL`)   | Trocar o bloqueio de um dia por uma janela curta (ex.: 15 min) com espera crescente por IP. Trocar o teto global por um limite **por conta**. Avisar na tela quanto tempo falta. |
| R2  | **Infra (fora do escopo)** | **Processamento por requisição acima de 10 ms.** Visão geral ~45 ms, Configurações ~37 ms, e cada verificação de senha (PBKDF2) ~21 ms. O plano gratuito da Cloudflare limita a 10 ms por requisição.                                                                                                                                                              | Rampa com 1 acesso: ~21 req/s em série. Medição do hash: 21 ms.                                                                      | Confirmar o plano. No plano pago (30 s), não há risco. No gratuito, reduzir as consultas da Visão geral (`getDashboard`) e avaliar menos iterações de PBKDF2.                    |
| R3  | Média                      | **A primeira visita no celular é lenta:** LCP de 3,7 a 4,4 s no 3G (local, sem compressão; ~2–2,5 s estimado com compressão).                                                                                                                                                                                                                                      | Seção 3.2                                                                                                                            | Ver R4 e R5. Também: carregar o painel de detalhe e os diálogos sob demanda.                                                                                                     |
| R4  | Média                      | **A tela de login baixa o app inteiro** (~1 MB sem compressão), embora só precise do formulário.                                                                                                                                                                                                                                                                   | Login com cache vazio: 966 KB, 13 requisições                                                                                        | Carregar `AppShell` sob demanda (`React.lazy`) só nas telas internas.                                                                                                            |
| R5  | Média                      | **Feito no Sprint 4:** `public/_headers` vai para `dist/client/` e o `vite preview` devolve `public, max-age=31536000, immutable` em `/assets/*`. **Arquivos que nunca mudam não ficam em cache.** Os arquivos com hash (`/assets/*`) saem com `max-age=0, must-revalidate`, e o navegador revalida tudo a cada visita.                                            | Cabeçalho do `app-shell-*.js`                                                                                                        | Criar `public/_headers` com `/assets/*` e `Cache-Control: public, max-age=31536000, immutable`. É uma mudança de uma linha, e o Workers Static Assets respeita esse arquivo.     |
| R6  | Baixa                      | **Botões não respondem antes do app "acordar".** Na primeira carga, um clique feito antes do React assumir a página é ignorado sem aviso. No celular lento isso dura ~3,6 s.                                                                                                                                                                                       | O roteiro de semente clicou em "Busca manual" logo após abrir a página e o diálogo não abriu; depois de carregado, abriu normalmente | Reduzir o bundle (R4) e mostrar o botão como "carregando" até o app assumir.                                                                                                     |
| R7  | Baixa                      | **Chave desativada sem explicação ao passar o mouse** ("Busca diária").                                                                                                                                                                                                                                                                                            | Seção 5                                                                                                                              | Já previsto no Sprint 5 (A13)                                                                                                                                                    |
| R8  | Baixa                      | **Relatados pelo agente do Sprint 3, não reproduzidos nesta rodada:** <ul><li>os botões da caixa de resposta quebram em duas linhas a 1280 px no estado "Precisa de você";</li><li>a busca de conversas pode voltar um valor antigo se você digitar enquanto a URL atualiza (o mesmo acontece em Leads);</li><li>o recorte do texto citado é heurístico.</li></ul> | Relatório do Sprint 3                                                                                                                | Conferir no uso real; corrigir junto com o Sprint 5                                                                                                                              |

---

## 8. Próximos passos sugeridos

1. **R1 e R5: feitos.**
   - R1: o bloqueio agora dura 15 minutos, conta por endereço e por conta (30 erros), e diz quanto falta. O teto global ficou só para o código de acesso, que fecha o cadastro, nunca o login.
   - R5: feito no Sprint 4.
2. **Nota para quem publicar (R2), fora do escopo deste trabalho, que cobre design e funcionamento.**
   - Confirmar o plano da Cloudflare do projeto.
   - No plano gratuito (10 ms de CPU por requisição), a Visão geral (~45 ms), Configurações (~37 ms) e o login (PBKDF2, ~21 ms) podem falhar. A saída é reduzir as consultas de `getDashboard` e as iterações de PBKDF2 (o formato do hash guarda as iterações, então dá para mudar sem invalidar senhas).
   - No plano pago (30 s), nada a fazer.
   - Antes do deploy: aplicar as migrations remotas (0007 a 0010 e as do Sprint 5; a 0007 apaga e-mails duplicados, então faça backup) e definir o secret `APP_PASSWORD`.
3. **R4 e R6 com o Sprint 5**, que já vai mexer em listas e formulários.
4. **Repetir esta bateria depois dos Sprints 4 e 5.** Os scripts usados estão descritos acima e podem virar um comando do projeto.
