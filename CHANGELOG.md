# Changelog — captacao-web

Mudanças relevantes deste frontend. Não é histórico de commit — só o que
importa pra quem quer entender a evolução do sistema sem ler `git log`.

## 2026-09-16 — Paginação na tabela de Processos da Carteira

- Mesmo tamanho e padrão visual do Histórico. Pedido direto, sem relação
  com performance dessa vez. Ver `docs/ARCHITECTURE.md`.
- Tamanho de página (Histórico e Carteira) reduzido de 12 para **10**, a
  pedido, logo em seguida.

## 2026-09-17 — Paginação em Clientes; Carteira mostra apelido do cliente

- Clientes ganhou paginação (5 por página), mesmo padrão da Carteira e do
  Histórico.
- Carteira mostra o apelido cadastrado do cliente em vez do texto digitado
  por extenso (ex.: "HUESKER LTDA" → "HUESKER"), deixando a tabela mais
  compacta. Casamento por CNPJ raiz primeiro, senão por prefixo do
  apelido; sem casamento nenhum, mantém o texto original — nunca esconde
  dado. Passa o mouse pra ver o texto original completo. Ver
  `src/lib/apelido.ts`.

## 2026-09-17 — Histórico: ETA também vira ordenável

- Só dava pra ordenar por "Registrado em". Coluna ETA agora tem a mesma
  mecânica (clica pra ver mais próxima ↔ mais distante primeiro). Trocar
  de coluna sempre começa mostrando o "maior" valor primeiro (mais
  recente/ETA mais distante).

## 2026-09-17 — Botões "Anterior"/"Próxima" mais visíveis

- Estavam só com o vidro fosco, sem borda nem sombra — apagados demais.
  Ganharam borda, sombra e cor de texto explícita, igual ao padrão já usado
  em outros botões secundários do app.

## 2026-09-17 — Paginação reduzida pra 5 (Carteira e Histórico)

- Era 10, pra teste com dado real. Ver `docs/ARCHITECTURE.md`.

## 2026-09-17 — Busca ignora espaço no final (Carteira e Histórico)

- Um espaço sobrando no fim da busca (BL, CE etc.) fazia não achar nada,
  mesmo o valor existindo. Clientes já ignorava; Carteira e Histórico não.

## 2026-09-17 — Botão "Sair" na Captação manual

- Não tinha jeito de sair sem salvar além de clicar num item do menu. Novo
  botão "Sair" (ao lado de "Anterior") volta pra tela de onde veio; se
  tiver dado digitado não salvo, confirma antes, igual ao aviso do menu.

## 2026-09-17 — Captação manual: linha de progresso acompanha onde você está

- A linha verde ficava parada no ponto mais distante já visitado — se
  voltasse pra uma etapa anterior, ela continuava lá na frente. Agora
  acompanha a etapa atual.

## 2026-09-17 — Captação manual: cor real de progresso, aviso antes de sair

- A bolinha de cada etapa ficava verde só por ter sido visitada, mesmo
  vazia. Agora reflete o preenchimento de verdade: verde (todos os campos),
  amarelo (parte), vermelho (nenhum). Revisão não tem campo próprio, conta
  como completa ao ser alcançada.
- Sair da tela (clicar num item do menu, fechar/atualizar a aba) com dado
  digitado e não salvo agora avisa antes de descartar. Não cobre
  voltar/avançar pelo navegador — limitação conhecida, ver comentário no
  código.

- Clica no cabeçalho pra inverter mais recente ↔ mais antigo primeiro,
  mesma mecânica que a Carteira ganhou pouco antes.

## 2026-09-17 — Coluna "Registrado em" na Carteira, ordenável

- A tabela de Processos não mostrava quando o processo foi feito (só o
  Histórico tinha). Nova coluna entre Cliente/Ref. e ETA, mesmo formato do
  Histórico. `formatData`/`formatDataHora` extraídos pra `lib/format.ts`
  (estavam duplicados só no Histórico).
- Coluna clicável pra ordenar (mais recente ↔ mais antigo primeiro), igual
  às outras colunas da tabela.

## 2026-09-17 — Carteira: sem porcentagem nos blocos de risco, ETA com ano

- Tirada a porcentagem (canto superior direito) dos 5 blocos de risco —
  ficava só o número mesmo.
- ETA na Carteira agora mostra o ano (`DD/MM/AAAA`) — antes só `DD/MM`,
  diferente do Histórico. Padronizado nas duas telas.

## 2026-09-17 — Avatar do rodapé virou um indicador de sessão ativa

- Corrigido: o círculo mostrava a inicial do e-mail, mas caía num
  placeholder fixo (a letra "V") enquanto o e-mail não carregava — não era
  intencional. Trocado por uma bolinha verde simples de "sessão ativa",
  sem depender de nenhum dado que possa demorar ou falhar.

## 2026-09-17 — Cartão de usuário do rodapé refeito

- Trocado o bloco escuro fixo (que não seguia o tema claro/escuro) por uma
  linha divisória simples, avatar circular com o vermelho da marca, sem a
  linha "Captação Inteligente" repetida (já está na logo, acima). Três
  alternativas visuais discutidas antes de escolher esta.

## 2026-09-16 — Enter avança etapa na Captação manual

- Pressionar Enter num campo de texto avança pra próxima etapa (ou salva,
  na última com campo), igual clicar em "Próximo". Não interfere no Select
  (continua escolhendo a opção normalmente).

## 2026-09-16 — Tooltip no gráfico de contêineres por mês

- Passar o mouse em qualquer bolinha do gráfico mostra o total daquele mês
  — antes só o último mês tinha o número visível o tempo todo, os outros
  dependiam do tooltip nativo do navegador (lento, pouco visível).

## 2026-09-16 — 401 desloga e manda pro login sozinho

- Sessão inválida/expirada não trava mais mostrando erro genérico — o app
  desloga e manda pra `/login` sozinho. Achado com uma funcionária que
  ficou "logada" com token ruim. Ver `docs/DECISIONS.md`.

## 2026-09-16 — Corrigido: excluir dava "Erro ao excluir" mesmo funcionando

- Causa real (não era cache, como se suspeitou a princípio): `DELETE`
  responde com corpo vazio, e `apiFetch` sempre tentava fazer `JSON.parse`
  nele — lançava exceção, mostrava erro genérico, e a tela nunca
  atualizava sozinha (precisava de F5, mesmo o registro já tendo sido
  excluído de verdade). Corrigido em `lib/api.ts`. Ver `docs/DECISIONS.md`.

## 2026-09-16 — Histórico "Tudo" ordena por data de registro

- Achado testando com dado real: aba "Tudo" ordenava por ETA (herdado do
  sistema antigo), então captação sem ETA sumia no fim de uma lista
  paginada. Agora ordena por data de registro, mais recente primeiro — ver
  `docs/DECISIONS.md`.

## 2026-09-15 — Reorganização de documentação

- Criada estrutura `docs/` (`ARCHITECTURE.md`, `DECISIONS.md`), separada da
  documentação histórica que vive no repositório do backend
  (`migration-plan/`).
- `README.md` e `CLAUDE.md` reescritos (antes eram boilerplate/só um
  `@AGENTS.md`).

## 2026-09-11/14 — Polish de UI e melhorias

- Rotas autenticadas movidas pra route group `(authed)/` com layout
  compartilhado — necessário pro indicador deslizante de navegação animar
  entre páginas.
- Modo escuro (`lib/theme.ts`), aplicado nos tokens `--vt-*`.
- Modo demo (`lib/mock-mode.ts`/`mock-backend.ts`/`mock-data.ts`).
- Componente `RowActions` padronizado (editar/excluir) em todas as tabelas.
- Paginação client-side no Histórico (12/página).
- Diversos ajustes visuais em Carteira, Dashboard, Captações, Clientes,
  Histórico e Login — ver `docs/ARCHITECTURE.md` para os pontos que viraram
  padrão (design tokens, componentes reutilizáveis).

## Antes de 2026-09-11

Ver `../captacao-api/migration-plan/` para o histórico completo da
migração das 5 telas a partir do sistema antigo (`captacao-valetrade`).
