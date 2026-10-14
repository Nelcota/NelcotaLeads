# 2ª revisão: achados

Execução de [prompt-revisao-2.md](prompt-revisao-2.md) em 13/10/2026. Os itens de [hardening-findings.md](hardening-findings.md) foram conferidos e **nenhum regrediu**. Severidade: alta / média / baixa.

## Segurança e sanitização

| id   | arquivo                                                       | sev   | achado                                                                                                  | correção                                                                                                          | status                                                  |
| ---- | ------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| S2-1 | src/routes/api/logout.ts, src/server/auth.ts                  | média | "Sair" só apagava o cookie; um cookie copiado continuava válido por 30 dias                             | `signOut` incrementa `session_version` (encerra a sessão no servidor); `/api/logout` público para não dar 401 cru | corrigido                                               |
| S2-2 | src/routes/leads/index.tsx, conversas.tsx, searches/index.tsx | média | `?view=foo`, `?minScore=500`, `?filter=x` derrubavam a página na tela de erro                           | `lenientSearch()`: parâmetro inválido é descartado; validadores do servidor continuam estritos                    | corrigido                                               |
| S2-3 | src/server/process-lead.ts                                    | média | Texto cru da IA/SDK (saldo, chave, JSON do Zod) aparecia em "A análise falhou: …"                       | `analysisErrorMessage()` com frases fixas; original só no log                                                     | corrigido                                               |
| S2-4 | src/server/collect.ts (E2E-3 da 1ª rodada)                    | baixa | Corpo da resposta do Google aparecia na tela Buscas                                                     | `searchErrorMessage()`; mantém a frase de limite diário que a tela Status reconhece                               | corrigido                                               |
| S2-5 | src/components/lead-detail.tsx                                | baixa | `mapsUrl` do Google ia para `href` sem checar o esquema                                                 | `safeHttpUrl()`                                                                                                   | corrigido                                               |
| S2-6 | src/server/auth.ts                                            | baixa | Redefinição responde "Não há conta com esse e-mail" e cadastro "e-mail em uso" (só após código correto) | —                                                                                                                 | adiado: decisão de produto                              |
| S2-7 | src/server/lead-bulk.ts                                       | baixa | "Desfazer" em massa aplica o status enviado pelo cliente, fora da tabela de transições                  | —                                                                                                                 | adiado: exige snapshot assinado ou guardado no servidor |
| S2-8 | src/routes/api/leads[.]csv.ts                                 | baixa | `POST` do CSV lê `formData()` sem limite de tamanho (só usuários logados)                               | —                                                                                                                 | adiado                                                  |

## Async, concorrência e lógica

| id   | arquivo                                   | sev   | achado                                                                                                   | correção                                                                                                    | status                                       |
| ---- | ----------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| L2-1 | src/server/mail-flow.ts                   | alta  | Lead descartado/encerrado pela lista, em massa ou no painel ainda recebia o e-mail que já estava na fila | `sendEmail` cancela o envio quando o lead está `discarded`/`closed` (cobre também `sendReply` de outra aba) | corrigido                                    |
| L2-2 | src/components/dispatch-sheet.tsx         | média | "Disparar" ficava ativo enquanto "Tirar do disparo"/"Gerar outra" rodava; o e-mail removido podia sair   | Botão desabilitado com o motivo no rótulo ("Tirando do disparo…")                                           | corrigido                                    |
| L2-3 | src/components/lead-detail.tsx            | média | "Marcar como contatado" não esperava salvar a mensagem editada; se falhasse, a edição se perdia          | Salva primeiro (`mutateAsync`); se falhar, o lead não muda                                                  | corrigido                                    |
| L2-4 | src/server/lead-edit.ts                   | baixa | Corrigir o e-mail do lead não mudava o destinatário de rascunhos/e-mails na fila                         | Rascunhos e fila não enviados seguem o novo endereço; endereço apagado cancela                              | corrigido                                    |
| L2-5 | src/routes/leads/index.tsx, conversas.tsx | baixa | Contagens do funil por nicho atrasavam até 60 s após ações em massa/encerrar                             | Invalida `["niches"]` junto                                                                                 | corrigido                                    |
| L2-6 | src/server/lead-bulk.ts                   | baixa | Toast diz "o status atual não permite" também para leads que já estavam no status escolhido              | —                                                                                                           | adiado                                       |
| L2-7 | src/server/niches.ts                      | baixa | `lower()` do SQLite não trata acentos: "Óticas" e "óticas" viram dois nichos                             | —                                                                                                           | adiado: exige coluna normalizada + migration |
| L2-8 | src/lib/today.ts                          | baixa | Tela aberta depois da meia-noite continua com o "hoje" de ontem                                          | —                                                                                                           | adiado                                       |
| L2-9 | src/routes/leads/index.tsx                | baixa | Lead descadastrado na seleção é contado como "sem e-mail"                                                | —                                                                                                           | adiado                                       |

## Padrões de navegador

| id    | onde                                    | o que aparecia                                                      | correção                                                                     | status                           |
| ----- | --------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------- |
| B2-1  | src/styles.css                          | Seta em vez de mãozinha em botões, abas, switches, checkboxes       | `cursor: pointer` na camada base; itens de menu mantêm a seta (estilo macOS) | corrigido                        |
| B2-2  | conversas.tsx, lead-detail.tsx          | URL longa no corpo do e-mail estourava a largura no celular         | `wrap-break-word`                                                            | corrigido                        |
| B2-3  | src/styles.css                          | Alça de redimensionar em todo textarea (que já cresce sozinho)      | `resize: none`                                                               | corrigido                        |
| B2-4  | buscas, Configurações, disparo, inline  | Lista de valores lembrados do Chrome sobre os campos do app         | `autoComplete="off"` (busca via `useUrlSearchBox`)                           | corrigido                        |
| B2-5  | src/styles.css                          | Flash cinza/azul ao tocar no Android                                | `-webkit-tap-highlight-color: transparent`                                   | corrigido                        |
| B2-6  | src/styles.css                          | Seleção de texto e cursor de digitação com o azul do sistema        | `::selection` e `caret-color` com as cores do app                            | corrigido                        |
| B2-7  | conversas, app-shell, respostas rápidas | Rolagem de painéis interna "vazava" para a página / pull-to-refresh | `overscroll-contain`                                                         | corrigido                        |
| B2-8  | src/styles.css                          | Links e cards arrastáveis com "fantasma"                            | `-webkit-user-drag: none` em links                                           | corrigido                        |
| B2-9  | lead-detail.tsx (retorno)               | Calendário nativo do `<input type="date">`                          | —                                                                            | mantido: decisão N6 do sprint 2  |
| B2-10 | —                                       | Impressão sai com sidebar e fundo escuro                            | —                                                                            | adiado: impressão fora do escopo |

Conferidos e corretos: nenhum `alert`/`confirm`/`prompt`; todo `<form>` com `noValidate`; nenhum `<select>`/checkbox nativo; nenhum `title=` em DOM; anel de foco global; fonte herdada nos controles; `color-scheme`, barras de rolagem finas, autopreenchimento, spinners e "x" de busca já tratados; 404/erro com a tela do app.

## Testes

- Unitários/worker: +10 testes (`signOut`, `lenientSearch`, `provider-errors`, envio cancelado para lead descartado, troca de e-mail com fila).
- E2E: `e2e/robustness.spec.ts` (parâmetros inválidos na URL, lead descartado após o disparo não recebe o e-mail, controles sem aparência de navegador); `errors.spec.ts` agora exige a frase fixa e proíbe o texto cru do Google.
- Não há E2E de logout: ele encerra a sessão da conta de teste compartilhada pelos outros specs; coberto pelo teste worker.

## Handoff (infra, não é do usuário)

- `APP_PASSWORD` é ao mesmo tempo código de acesso e chave de assinatura das sessões. Recomendado um secret separado (`SESSION_SECRET`) para a assinatura.
- CSP `script-src` continua aberta (SEC-11 da 1ª rodada): precisa de nonce no SSR.
- "Sair" agora encerra a sessão em **todos** os aparelhos da conta (sessões não são guardadas individualmente).
