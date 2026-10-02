# Changelog — captacao-web

Mudanças relevantes deste frontend. Não é histórico de commit — só o que
importa pra quem quer entender a evolução do sistema sem ler `git log`.

## 2026-10-02 — Tirado o botão de sol/lua (claro/escuro) do cartão de usuário

- Pedido direto. O toggle de modo claro/escuro saiu do `AppShell` — ficava
  ao lado do avatar/e-mail, junto do botão de sair. `applyTheme(getTheme())`
  continua rodando na montagem (quem já tinha escolhido escuro antes
  continua vendo escuro), só não tem mais como trocar pela UI.

## 2026-10-02 — Tela Config: escolher entre tema "Novo" e "Clássico"

- Pedido direto: poder alternar entre os dois temas visuais, não só ficar
  fixo no "Novo" do dia anterior.
- Nova tela `/config` (rota + item "Config" no menu, seção "Sistema"):
  dois cards — "Novo" (sidebar preta sólida/item ativo vermelho/fundo
  pérola) e "Clássico" (sidebar em vidro seguindo claro/escuro, fundo
  creme com gradiente) — com um preview em miniatura de cada um.
- `lib/skin.ts` (`getSkin`/`applySkin`, padrão igual a `lib/theme.ts`):
  persiste em `localStorage` (`vt-skin`), aplica `data-skin` na raiz.
  Padrão é `"new"` quando não há nada salvo — quem nunca abriu `/config`
  continua vendo exatamente o que já estava publicado, sem mudança.
- `globals.css`: as regras de `--vt-page-bg`, `.vt-ambient-bg` e `.vt-side`
  (+ textos/indicador da sidebar) voltaram a ter a versão "Clássico" como
  base, com o "Novo" sobrescrevendo via `:root:not([data-skin='classic'])`
  — não é um tema novo substituindo o outro, os dois convivem no CSS.
- Aplicado no `AppShell` junto do toggle de claro/escuro (mesmo `useEffect`
  de inicialização).

## 2026-10-01 — Sidebar preta, fundo pérola (referência cotacoes-valetrade-code)

- Pedido direto do Pedro: deixar o app com a "cara" do `cotacoes-valetrade-code`
  (outro frontend da Valetrade) sem mudar conteúdo, comportamento ou
  estrutura de nenhuma tela — só o tema visual.
- `--vt-page-bg` (fundo da página, tema claro): creme `#f3efe8` → pérola/neve
  `#F3F4F6`.
- `.vt-ambient-bg`: era gradiente com 3 manchas coloridas (vermelho/dourado/
  verde) + base creme/escura — virou chapado, só `var(--vt-page-bg)`. Bloco
  `[data-theme='dark'] .vt-ambient-bg` (agora redundante) removido.
- `.vt-side` (sidebar): era vidro translúcido com a cor do tema por trás —
  agora preta sólida (`#11141A`) sempre, independente do tema claro/escuro.
  Textos do menu ganharam cor fixa clara (não seguem mais `--vt-ink`/
  `--vt-muted`, que dependem do tema).
- `.vt-nav-ind` (indicador deslizante atrás do item ativo do menu): era vidro
  claro (sumia em cima do preto) — agora vermelho sólido (`--vt-red`), texto
  do item ativo em branco. Mesma mecânica de antes (JS mede posição/altura
  do link ativo), só a cor mudou.
- Cards com glass/blur, fonte IBM Plex, cores dos blocos de risco (Crítico/
  Próximos 7 dias/Em andamento/Efetivado) — tudo mais continua igual.

## 2026-10-01 — Ajuste no botão de calendário: só ícone, popover opaco

- Botão de mês, fechado, mostra só o ícone (sem o texto "MÊS") — texto do
  mês abreviado continua aparecendo quando já há um mês selecionado.
- Popover de meses usava `vt-glass-strong` (fundo semi-transparente com
  blur) — ficava difícil de ler sobre a tabela. Trocado por `--vt-surface`
  (sólido, mesmo token do drawer/modal da aplicação).

## 2026-10-01 — Carteira: filtro de mês (botão calendário) e badge "EM ANDAMENTO"

- Botão de calendário ao lado da faixa de cards de risco: abre lista de
  meses com captação criada (mais recente primeiro, com contagem), filtra a
  tabela por `createdAt` — quando o processo foi **registrado**, não quando
  mudou de status. Combina com o card de risco selecionado.
- Badge de status da linha (coluna Status) que mostrava "JANELA ABERTA"
  (processos com ETA em 3-7 dias) agora mostra "EM ANDAMENTO" — pedido
  explícito, confundia. O card "Próximos 7 dias" na faixa de risco não
  mudou de nome, só o texto do badge na linha.

## 2026-10-01 — Carteira: tirada a frase "janela de 7 dias / regime pendente"

- O alerta no topo só mostra mais o aviso de crítico ("N processo(s) viram
  tabela pública hoje se não forem efetivados"). Quando não há nenhum
  crítico, o alerta inteiro some — antes aparecia com a frase "Há N na
  janela de 7 dias aguardando captação e M com regime pendente".

## 2026-10-01 — Carteira: blocos de risco corrigidos

- **"Concluído" saiu** da lista de blocos — não tinha utilidade real ali.
- **"Efetivado" agora conta todo mundo**, não só quem tem embarque casado
  no momento (mostrava ~80 em vez de 300+ reais) — correção no backend,
  ver `CHANGELOG.md` do `captacao-api`.
- **Crítico e Próximos 7 dias passam a olhar o ETA de verdade.** Antes, um
  processo com documentação incompleta caía sempre em "Em andamento",
  mesmo com ETA pra amanhã — agora, qualquer captação não efetivada com
  ETA em até 2 dias é Crítico, até 7 dias é Próximos 7 dias. Documentação
  completa e parada continua sempre Crítico, independente do ETA — isso
  não mudou (é a regra que avisa antes de virar tabela pública).

## 2026-10-01 — Novo passo "Carregamento" na captação manual

- Formulário ganha o 6º passo, **Carregamento** (entre Situação e Revisão):
  Data de carregamento + Transportadora. O passo Terminal ganha Data de
  chegada, sem virar passo à parte.
- Revisão virou o 7º passo — `?step=6` na URL (Carteira/Histórico usam
  isso pra abrir direto nela), não mais `?step=5`.
- Três campos novos na captação (`dataCarregamento`, `transportadora`,
  `dataChegada`) — captações antigas ficam com eles vazios. Depende de
  mudança de schema no backend (`captacao-api`, ainda pendente em
  produção, ver `CHANGELOG.md` de lá).

## 2026-09-29 — Fonte trocada pra IBM Plex Sans (+ Plex Mono)

- O app rodava Inter — a variável se chamava `--font-geist-sans` desde o
  template inicial do Next.js, mas nunca foi a fonte Geist de verdade.
  Trocado por IBM Plex Sans (texto) + IBM Plex Mono (números/códigos:
  CNPJ, container, BL, barras do Dashboard) — desenhada pra interface densa
  de dado, que é a maior parte do app. Variáveis renomeadas pra
  `--font-plex-sans`/`--font-plex-mono`, nome batendo com a fonte real
  pela primeira vez.

## 2026-09-29 — Carteira e Histórico: só o Status abre a Revisão

- Antes, clicar em qualquer ponto da linha navegava pro passo 6 (Revisão).
  Agora só o campo de Status é clicável — o resto da linha não faz nada.
  A seta no fim da linha saiu (sugeria clique na linha inteira, que não
  existe mais).

## 2026-09-29 — Carteira e Histórico: CE volta como coluna própria

- CE Mercante tinha saído das duas tabelas na simplificação de 6 colunas
  (23/09/2026), ficando só dentro da Revisão. Volta como coluna, entre ETA
  e Despachante — 7 colunas + a seta agora.

## 2026-09-28 — Clientes: busca sobe pro topo, cabeçalho enxuto

- Duas rodadas no mesmo pedido, no mesmo dia: primeiro o rótulo "Clientes
  cadastrados" saiu e a busca foi pra uma barra própria acima da tabela,
  com contador "N clientes" no cabeçalho; depois o próprio subtítulo
  ("Cadastro usado para identificar...") e o contador saíram também.
  Ficou: título + busca, lado a lado, no topo da página. Tabela começa
  direto no cabeçalho de colunas, sem barra própria.

## 2026-09-28 — Clientes: coluna mostra o CNPJ inteiro, não só a raiz

- A tabela mostrava só os 8 dígitos da raiz (`cnpjRaiz`, usados pra achar
  duplicata). Agora mostra o CNPJ completo (`cnpj`, o que foi digitado no
  cadastro). Busca passa a considerar os dois campos.

## 2026-09-25 — Skeleton no lugar de "Carregando…"

- Novo `components/ui/skeleton.tsx` (shadcn) e `components/table-skeleton.tsx`
  (5 linhas-esqueleto pra tabela). Cor vem do token novo `--vt-sk`, com par
  claro/escuro; respeita `prefers-reduced-motion`.
- Trocou o "Carregando…" numa linha só nas tabelas de Carteira, Histórico e
  Clientes, e o "Carregando captação…" da edição (agora desenha as seções
  da Revisão).
- Blocos de risco da Carteira mostravam `0` enquanto carregavam (parecia
  dado real) e os do Dashboard mostravam `—`: agora mostram uma barra.
- Se a API falhar, o esqueleto some e aparece a mensagem de erro, como antes.

## 2026-09-23 — Carteira e Histórico: mesmo tamanho de fonte em toda célula

- As células de dado tinham 4 tamanhos diferentes na mesma linha (14px sem
  classe, 13.5px, 12px mono nas datas, 11px na referência). Padronizado
  pra 13px em toda célula de dado (cliente, referência, Registrado em,
  ETA, Despachante, Atracação → Parceiro), sem fonte monoespaçada nas
  datas — hierarquia entre texto principal e secundário passa a vir só de
  cor/peso, não de tamanho.
- O badge de Status (`.vt-band`) ficou de fora de propósito — é o mesmo
  componente usado em vários lugares do app (Dashboard, "provável" etc.);
  mudar o tamanho dele mudaria essas outras telas também.
- Cabeçalhos das colunas continuam no padrão de rótulo (11px maiúsculo) —
  isso é convenção da aplicação inteira, não a inconsistência que foi
  corrigida.

## 2026-09-23 — Registrado em: vírgula trocada por hífen

- `formatDataHora` (Carteira/Histórico) mostrava data e hora separadas por
  vírgula (`18/09/2026, 14:30`, formato padrão do `toLocaleString('pt-BR')`)
  — trocado por hífen (`18/09/2026 - 14:30`).

## 2026-09-23 — Carteira e Histórico: clicar no processo abre a Revisão (2ª rodada, sem drawer)

- Volta atrás na ideia do drawer de detalhe (ver entradas abaixo, mesmo
  dia): em vez de um painel novo repetindo o formulário, clicar no processo
  agora leva direto pro **passo 6 (Revisão)** da captação — a tela que já
  mostra tudo em 5 seções, cada uma com "Editar", e já tem o botão Excluir.
- Tabela ganhou 6 colunas nas duas telas: Status, Cliente/Ref., Registrado
  em, ETA, Despachante e Atracação → Parceiro. Sem coluna de Ações — editar
  e excluir agora só existem dentro da Revisão.
- `captacoes/page.tsx` aceita `?step=N` pra abrir direto num passo (antes
  sempre abria no passo 1, mesmo editando).
- Carteira: linha sem captação casada (só embarque) continua indo pro
  fluxo de criar uma captação nova, como antes.
- **Perdido de propósito:** excluir/editar não têm mais atalho de um clique
  só na tabela — precisa entrar no processo primeiro.

## 2026-09-23 — Histórico: mesmo tratamento da Carteira (4 colunas + drawer)

- Tabela tinha 10 colunas com scroll horizontal (Status, Cliente/Referência,
  Registrado em, ETA, Regime, CE, BL, Navio, Despachante, Atracação →
  Parceiro). Agora mostra só Status, Cliente/Referência, Registrado em e
  ETA — as duas continuam ordenáveis pelo cabeçalho, do jeito que já eram.
- Clicar em qualquer ponto da linha abre o mesmo tipo de drawer da Carteira,
  com todos os campos (Regime, CE, HBL — todos os BLs juntos, sem mais
  truncar/"+N" —, Navio, Despachante, Atracação/Parceiro, Observação, Docs
  recebidos, Tabela pública) nas 5 seções do formulário de captação.
- O antigo drawer "BLs deste processo" (badge "+N" quando tinha mais de um
  BL) foi substituído por este — a lista de BLs agora mora dentro do campo
  HBL do drawer principal, sem precisar de um segundo painel.
- **Perdido de propósito:** não dá mais pra ordenar por Regime, CE, BL,
  Navio ou Despachante direto pelo cabeçalho — saíram da tabela. Ver
  `docs/ARCHITECTURE.md`.

## 2026-09-23 — Carteira: 4 colunas + drawer de detalhe (fim do scroll horizontal)

- Pedido: a tabela de Processos tinha 9 colunas e exigia rolar pros lados
  pra ver tudo; o tamanho da fonte também variava de coluna pra coluna.
- Tabela agora mostra só Status, Cliente/Ref., ETA e Atracação → Parceiro.
  Clicar em qualquer ponto da linha abre um drawer de baixo pra cima
  (`components/ui/drawer.tsx`, já existia no projeto) com todos os campos —
  Regime, Despachante, Navio, CNPJ, CE, HBL, Container(s), Registrado em
  etc. — organizados nas mesmas 5 seções do formulário de captação
  (Identificação, Carga, Aduana, Terminal, Situação).
- Editar/excluir continuam com ícone próprio no fim da linha
  (`RowActions`) e não abrem o drawer ao serem clicados.
- **Perdido de propósito:** não dá mais pra ordenar por Registrado em,
  Regime, Despachante ou Navio direto pelo cabeçalho — essas colunas
  saíram da tabela. Status, Cliente e ETA continuam ordenáveis. O padrão
  de "mais recente primeiro" (17/09/2026) continua valendo por baixo, só
  não tem mais cabeçalho pra trocar por Regime/Despachante/Navio. Se sentir
  falta, ver `docs/ARCHITECTURE.md`.

## 2026-09-22 — Captação manual: cliente sugerido, CNPJ automático, despachante vira select

- Pedido: "colocar opção de selecionar o despachante, em vez de digitar" e
  "colocar preenchimento de CNPJ apos selecionar o CLIENTE".
- **Cliente:** ao digitar, aparece uma lista de clientes cadastrados que
  batem por nome ou apelido; selecionar um preenche o CNPJ automaticamente
  a partir do cadastro. Continua sendo texto livre — cliente não cadastrado
  não é bloqueado, só não tem sugestão nem preenchimento automático.
- **Despachante:** virou `Select` com as 4 opções do sistema antigo
  (LOGMAIS, NIRRON, ATHENA, AUDAZ) + "+ novo despachante" pra digitar
  qualquer outro nome — a migração tinha isso como campo de texto livre,
  sem querer, perdendo o select do original. Ver `docs/ARCHITECTURE.md`
  (limitação de teste conhecida do popup em jsdom).

## 2026-09-21 — Carteira: busca acha pelo HBL digitado na captação

- Quando o BL do embarque era diferente do digitado na captação (casamento
  por CE), a busca por HBL não achava. A API agora manda `blCap`/`ceCap` e a
  busca (e o "Rastrear") passam a considerá-los. Depende do deploy do
  backend.

## 2026-09-16 — Paginação na tabela de Processos da Carteira

- Mesmo tamanho e padrão visual do Histórico. Pedido direto, sem relação
  com performance dessa vez. Ver `docs/ARCHITECTURE.md`.
- Tamanho de página (Histórico e Carteira) reduzido de 12 para **10**, a
  pedido, logo em seguida.

## 2026-09-17 — Carteira: padrão passa a ser o registro mais recente

- Antes ordenava por ETA mais urgente primeiro. Continua dando pra ordenar
  por qualquer coluna clicando nela — só o padrão ao abrir a tela mudou.

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
