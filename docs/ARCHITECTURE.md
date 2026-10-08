# Arquitetura — captacao-web

> Este documento descreve o sistema **como ele funciona hoje** (15/09/2026).
> Para arquitetura cruzando os dois repositórios (fluxo completo, decisões
> da migração em si), ver `../../captacao-api/migration-plan/` (histórico)
> e `../../captacao-api/docs/ARCHITECTURE.md` (visão viva).

## Visão geral

Next.js (App Router), fala com o backend real (`captacao-api`) por HTTP.
Nenhum acesso a banco de dado a partir daqui — o único uso do SDK do
Supabase é autenticação (login/logout, `lib/supabase.ts`).

```
Browser
  │  login/logout: supabase-js direto (sessão em localStorage)
  │  todo dado de negócio: fetch(NEXT_PUBLIC_API_URL + rota, Authorization: Bearer <jwt>)
  ▼
captacao-api (repositório separado)
```

## Next.js / App Router

`src/app/`:
- `login/page.tsx` — única rota fora do grupo autenticado. Se já existe
  sessão válida, redireciona pra última tela visitada
  (`lib/last-view.ts`).
- `(authed)/` — **route group**: as 5 telas autenticadas (`carteira`,
  `clientes`, `captacoes`, `historico`, `dashboard`) e um `layout.tsx`
  próprio que renderiza `<AppShell>{children}</AppShell>`.
- `page.tsx` (raiz) — sem tela própria, sempre redireciona pra `/login`.

**Por que route group e não um componente `AppShell` chamado em cada
página:** o indicador deslizante da navegação (a "saliência" de vidro que
anima de um item pro outro no menu lateral) precisa que o `AppShell`
persista entre navegações. Se cada página renderizasse seu próprio
`<AppShell>`, ele seria desmontado/remontado a cada troca de rota e o
indicador só apareceria/desapareceria, sem animar. Um `layout.tsx` de
verdade dentro do route group resolve isso — é decisão deliberada, não
increased boilerplate por acaso.

## Comunicação com o backend

`lib/api.ts` (`apiFetch<T>`) é o único ponto de chamada HTTP pra dado de
negócio:
1. Se modo demo está ativo (`isMockMode()`), desvia pra `mock-backend.ts`
   sem nenhuma rede real.
2. Senão, pega a sessão atual do Supabase (`getSupabase().auth.getSession()`),
   monta `Authorization: Bearer <access_token>` (se houver sessão), chama
   `NEXT_PUBLIC_API_URL + path`.
3. Resposta não-ok vira `ApiError` (status + mensagem do corpo).

Nenhuma tela chama `fetch` direto pra API — sempre por `apiFetch`.

## Autenticação

Login e recuperação de senha usam o SDK do Supabase (`lib/supabase.ts`)
direto do navegador — é o único lugar deste repo que fala com o Supabase.
A sessão resultante vive em `localStorage` (gerenciado pelo próprio SDK),
**nunca chega ao servidor Next.js** — por isso toda busca de dado
autenticado acontece no client (`useEffect` + `apiFetch`), nunca em Server
Component (que não teria como montar o header `Authorization`).

## `AppShell` (`src/components/app-shell.tsx`)

Layout persistente das telas autenticadas:
- Sidebar com navegação (`Link` do Next) e indicador deslizante calculado
  via `useLayoutEffect` (mede a posição real do link ativo, não hardcoda
  índice).
- Busca `GET /auth/me` uma vez (não a cada navegação) pra mostrar o e-mail
  do usuário logado no rodapé.
- Busca `GET /carteira` uma vez (não a cada navegação) só pra calcular o
  badge de "críticos" no item Carteira do menu — refazer essa busca a cada
  troca de página já causou lentidão perceptível notada pelo usuário; a
  correção foi trocar a dependência do efeito de `[pathname]` para `[]`.
- Botão de tema (sol/lua) e botão de logout, juntos num "cartão de
  usuário" no rodapé (não itens soltos de menu).
- Banner fixo no topo quando modo demo está ativo.

## Componentes importantes

- `components/row-actions.tsx` — par de ícones editar/excluir
  (`lucide-react`, `Pencil`/`Trash2`), único padrão visual desse par em
  toda a aplicação (Carteira, Histórico, Clientes). Não recriar esse par
  numa tela nova.
- `components/segmented-control.tsx` — pílula deslizante genérica (usada em
  filtros de período), mesmo princípio de medir posição real via DOM em vez
  de calcular por índice.
- `components/ship-scene.tsx` — decoração animada (SVG de navio) e
  `EmptyState`, usado em tabelas vazias.
- `components/ui/*` — primitivos shadcn (`base-ui`), tema aplicado via
  atributos `data-slot` no CSS global (ver Design System abaixo).

## Tipografia

`src/app/layout.tsx` carrega **IBM Plex Sans** (texto) e **IBM Plex Mono**
(`font-mono` — CNPJ, código de container/BL, barras do Dashboard) via
`next/font/google`, nas variáveis `--font-plex-sans`/`--font-plex-mono`
(mapeadas pra `--font-sans`/`--font-mono` do Tailwind em `globals.css`).
Trocado de Inter em 29/09/2026 — o nome das variáveis dizia "geist" desde
o template inicial do Next.js mesmo quando a fonte real era Inter, nunca
Geist de verdade; corrigido junto da troca.

## Design system — tokens `--vt-*`

Todo o visual da aplicação usa variáveis CSS customizadas com prefixo
`--vt-` definidas em `src/app/globals.css` (`:root`), copiadas
originalmente do sistema legado (`captacao-valetrade`) — cores de marca
(`--vt-red`, `--vt-ink`), cores de faixa de risco (`--vt-c-prej`,
`--vt-c-jan`, `--vt-c-and`, `--vt-c-efet`, `--vt-c-conc`), efeito de vidro
(`--vt-glass`, `--vt-blur`), sombra, raio de borda.

**Regra:** cor nova na interface deve ser uma variável `--vt-*` nova (com
par claro/escuro, ver abaixo), nunca um valor hexadecimal solto num
componente — isso já causou bug real (badge de Regime na Carteira e o "✕"
de aliases em Clientes usavam `rgba(40,36,28,...)` fixo, ilegível no modo
escuro até serem trocados pelos tokens).

**Sidebar preta sólida, sem variar por tema** (01/10/2026, pedido direto —
referência visual do `cotacoes-valetrade-code`, outro frontend da
Valetrade): `.vt-side` deixou de usar `var(--vt-glass)` (vidro translúcido
com a cor do tema por trás) e virou `#11141A` fixo nos dois temas — é a
única parte da interface que não segue `--vt-ink`/`--vt-muted` do tema
ativo; os seletores `.vt-side .vt-nav`/`.vt-nav-sec`/`.vt-user-meta .email`
etc. têm cor clara fixa própria. O indicador deslizante atrás do item ativo
(`.vt-nav-ind`, posição calculada em JS no `AppShell`) também parou de usar
glass e virou vermelho sólido (`--vt-red`), texto do item ativo em branco.
`--vt-page-bg` (fundo da página, tema claro) mudou de creme (`#f3efe8`)
pra pérola/neve (`#F3F4F6`); `.vt-ambient-bg` (antes um gradiente com 3
manchas coloridas atrás do conteúdo) virou chapado, só a cor de
`--vt-page-bg` — pedido explícito ("não gostei, pois não está tudo somente
branco"). Cards com glass, fonte IBM Plex e cores das faixas de risco não
mudaram.

**Tema visual escolhível — "Novo" vs "Clássico"** (02/10/2026): o visual
acima ("Novo") deixou de ser fixo — pedido pra poder alternar de volta pro
visual anterior ("Clássico": sidebar em vidro, fundo creme com gradiente).
Implementado como um terceiro eixo de tema, independente do claro/escuro:
- `lib/skin.ts` (`Skin = 'classic' | 'new'`, `getSkin`/`applySkin`) — mesmo
  padrão de `lib/theme.ts`, persiste em `localStorage` (chave `vt-skin`) e
  aplica `data-skin` na raiz do documento. **Padrão é `'new'`** quando não
  há nada salvo (sessão nunca abriu `/config`) — garante que ninguém via o
  visual mudar sozinho na primeira visita depois do deploy.
- `globals.css`: as regras específicas do "Novo" (`--vt-page-bg` pérola,
  `.vt-ambient-bg` chapado, `.vt-side` preta + textos/indicador da sidebar)
  viraram overrides sob `:root:not([data-skin='classic'])`, por cima da
  versão "Clássico" (que voltou a ser a base/default do CSS, sem nenhuma
  classe extra — é o que `.vt-side`/`.vt-nav`/`.vt-ambient-bg` etc. já
  eram desde sempre). Nenhuma regra foi duplicada — "Clássico" é
  literalmente o CSS de antes de 01/10/2026, intacto.
- Tela `/config` (`src/app/(authed)/config/page.tsx`, nova, item "Config"
  no menu em "Sistema"): dois cards com preview em miniatura de cada tema;
  clicar chama `applySkin` na hora, sem reload. Primeira configuração de
  usuário do app — página existe só pra isso por enquanto.
- Aplicado no `AppShell`, no mesmo `useEffect` que já carregava o tema
  claro/escuro na montagem.

## Modo escuro

`lib/theme.ts` — flag `light`/`dark` persistida em `localStorage`,
aplicada como atributo `data-theme` na raiz do documento. `globals.css`
redefine os tokens `--vt-*` neutros (fundo, texto, linhas, vidro) sob
`[data-theme='dark']` — **as cores de status (faixas de risco) são
propositalmente as mesmas nos dois temas**, pra não perder o significado
(crítico continua vermelho em qualquer tema). Toggle fica no cartão de
usuário do `AppShell`.

Página de login tem overlay/ambiente próprio (`vt-login-overlay`,
`vt-ambient-bg`) com variante escura definida à parte — não reaproveita
automaticamente os tokens do resto do app porque o login não fica dentro
do `(authed)/layout.tsx`.

## Modo demo

`lib/mock-mode.ts` (flag em `localStorage`) + `lib/mock-backend.ts`
(roteador falso em memória) + `lib/mock-data.ts` (dados fixos).

- **Como é ativado:** botão "Ver demonstração" na tela de login
  (`enableMockMode()` + navega pra `/carteira`), sem precisar de
  credencial nenhuma.
- **O que simula:** `GET /carteira`, `GET`/`POST /clientes`, `GET`/
  `POST /captacoes`, `POST /captacoes/captado`, `POST /import/logcomex`,
  `GET /auth/me` — ver `mock-backend.ts` pra lista exata e atualizada de
  rotas simuladas.
- **Dados:** fixos em `mock-data.ts`, em memória — qualquer alteração feita
  na sessão (criar cliente, editar captação) **não é salva de verdade**,
  some ao recarregar a página.
- **Por que existe:** permite navegar e demonstrar a interface inteira sem
  depender de backend real no ar nem de credencial de banco — útil pra
  revisão de UI e pra mostrar o sistema a alguém sem acesso de produção.
  Um banner fixo no topo (renderizado pelo `AppShell`) avisa sempre que
  o modo está ativo, pra não ser confundido com dado real.
- Desativado automaticamente no logout (`disableMockMode()`).

## Decisões relevantes

- **Fetch client-side, nunca Server Component, em telas autenticadas** —
  ver seção Autenticação acima. Decisão registrada originalmente em
  `../../captacao-api/migration-plan/architecture/DECISIONS.md`.
- **Paginação client-side no Histórico e na Carteira** (5 itens/página,
  mesmo tamanho nas duas — era 12, depois 10, reduzido a pedido de novo em
  17/09/2026 pra facilitar teste). No Histórico foi implementada como tentativa de
  resolver uma lentidão percebida ao navegar pra essa tela; a causa raiz
  real acabou sendo a busca redundante de `/carteira` no `AppShell` a cada
  navegação (ver acima), não o volume de linhas da tabela — a paginação
  ficou como melhoria de UX de qualquer forma, mas não deve ser tratada
  como "a" correção de performance se um problema parecido reaparecer.
  Na Carteira (16/09/2026, pedido direto) foi puro pedido de UX pra tabela
  de Processos, sem relação com performance. Nas duas, a página volta pra 1
  sempre que um filtro muda o conjunto exibido (ajuste durante o render,
  não em efeito — ver comentário no código). Clientes ganhou o mesmo
  padrão em 17/09/2026.
- **Carteira busca `/clientes` além de `/carteira`** (17/09/2026), só pra
  trocar o nome exibido do cliente pelo apelido cadastrado (`lib/apelido.ts`)
  — o campo `cli` da captação/embarque é texto livre, às vezes vem por
  extenso. Busca própria, silenciosa (falha não trava a tela, só mantém o
  texto original). Nos testes, o mock de `apiFetch` precisou virar
  path-aware (responde pela rota pedida, não pela ordem de chamada) — duas
  chamadas em paralelo quebravam a fila de `mockResolvedValueOnce` de
  qualquer teste que não soubesse da segunda chamada.
- **Carteira e Histórico: clicar no processo leva direto pro passo 6
  (Revisão) da captação** (23/09/2026, segunda rodada — substitui uma
  tentativa anterior com drawer de detalhe, que chegou a ser implementada
  e revertida no mesmo dia). Nas duas telas a tabela mostra 6 colunas —
  Status, Cliente/Ref., Registrado em, ETA, Despachante, Atracação →
  Parceiro — sem coluna de Ações: a célula de Status (`tabIndex`/`onKeyDown`,
  sem `role="button"` — isso sobrescreveria o role nativo `row` da tabela e
  quebraria `getAllByRole('row')` nos testes e em qualquer leitor de tela)
  navega com `router.push('/captacoes?edit=<id>&step=5')` — a princípio a
  linha inteira era clicável, mas restrito só ao Status em 29/09/2026 a
  pedido, pra não navegar sem querer ao interagir com o resto da linha
  (a seta que indicava "linha inteira clicável" saiu junto). O passo 6
  (Revisão) já existia no formulário de captação e já mostra tudo — as 5
  seções com `RecapSection`/`RecapItem`, cada uma com "Editar", e o botão
  Excluir — então passou a servir de "ver detalhes" das duas telas, sem
  precisar de UI nova. `captacoes/page.tsx` ganhou suporte a `?step=N`
  pra abrir direto nesse passo (antes sempre abria no passo 1, mesmo
  editando); veja `initialStep` em `CaptacoesForm`.
  Na Carteira, uma linha sem captação casada (só embarque da Logcomex,
  sem `capId`) não tem o que revisar — o clique cai no fluxo de criar uma
  captação nova (`captar()`, reaproveitada da versão anterior à simplificação
  de 14/09/2026), pré-preenchida com o que já se sabe do embarque.
  **Trade-off aceito:** sem coluna de Ações, editar e excluir exigem entrar
  na Revisão primeiro — não tem mais atalho de um clique só na tabela.
  Regime, BL e Navio (Histórico) e Regime (Carteira) não aparecem em
  nenhuma das duas telas fora da Revisão — CE voltou como coluna própria
  (29/09/2026), entre ETA e Despachante, nas duas tabelas. Toda célula de dado nas duas
  tabelas usa 13px, sem fonte monoespaçada nas datas — corrigido depois
  (23/09/2026) porque tinha 4 tamanhos diferentes na mesma linha. O badge
  de Status (`.vt-band`) fica de fora por ser componente compartilhado com
  outras telas do app.
- **Formulário de captação ganha o 6º passo "Carregamento"** (01/10/2026):
  `STEPS` passa de 6 pra 7 itens (`Identificação, Carga, Aduana, Terminal,
  Situação, Carregamento, Revisão`) — Carregamento entra **depois** de
  Situação, não logo depois de Carga, com só dois campos:
  `dataCarregamento` e `transportadora`. O passo Terminal ganha um terceiro
  campo, `dataChegada`, sem virar passo à parte. `Revisão` passou a ser o
  7º passo (índice 6) — os links `?step=6` da Carteira/Histórico (ver
  item acima) apontam pra ela, não mais `?step=5`. Os três campos são
  `string | null` (`'YYYY-MM-DD'` nas duas datas), tratados pelo backend
  igual ao `eta`/`cnpj`: captações anteriores a essa data ficam com os três
  `null`. Mudança de schema em produção ainda pendente — ver
  `captacao-api/docs/ARCHITECTURE.md`.
- **Passo Carregamento ganha `dataChegadaDestino`** (08/10/2026): pedido
  direto de "data de chegada" nesse passo — já existia `dataChegada` no
  passo Terminal (chegada **no terminal**), então o campo novo tem nome
  próprio em vez de reaproveitar, pra não confundir as duas datas
  (`dataChegada` = terminal, `dataChegadaDestino` = destino final, depois
  do carregamento). Rótulo na tela: "Data de chegada (destino)". Mesma
  regra de `'YYYY-MM-DD'`/`null` dos outros campos do passo. Mudança de
  schema em produção ainda pendente.
- **Blocos de risco da Carteira corrigidos** (01/10/2026, `lib/risco.ts`):
  - **"Concluído" saiu da lista `BANDS`** (não é mais um bloco de contagem).
    `banda()` ainda classifica `stage === 'SAIU'` como `'conc'` — o badge de
    Status da linha continua mostrando "CONCLUÍDO" quando aplicável, só não
    tem mais bloco pra isso.
  - **Crítico e Próximos 7 dias agora decidem pela proximidade real do
    ETA**, não só pelo stage. Antes, qualquer captação com doc incompleto
    (`MANIFESTADA_PARC`) caía sempre em "Em andamento", mesmo com ETA
    amanhã — só embarque sem nenhuma captação casada (`stage: 'NENHUM'`)
    chegava a ser avaliado pelo `diasAte(eta)`. Doc completo e parado
    (`MANIFESTADA_DOCS`) continua sempre Crítico, direto, sem olhar o ETA —
    regra de negócio deliberada (vira tabela pública se não for efetivado),
    não é o que estava errado.
  - **Esses dois ajustes dependem do backend**: o segundo só revela
    processos que antes eram invisíveis na Carteira (captação `EFETIVA`
    sem embarque casado) — ver `captacao-api/docs/DECISIONS.md`
    (2026-10-01) pro porquê o card "Efetivado" mostrava ~80 em vez de 300+.
  - Grade dos blocos: `sm:grid-cols-5` → `sm:grid-cols-4`.
- **Filtro de mês na Carteira** (01/10/2026): botão calendário ao lado da
  faixa de cards de risco, abre lista de meses com captação criada (mais
  recente primeiro, com contagem) e filtra a tabela por `createdAt` —
  quando o processo foi registrado, nunca quando mudou de status.
  Independente do card de risco selecionado, os dois filtros combinam
  (AND). Estado `mesFiltro` ('YYYY-MM' ou `null`), popover fecha ao clicar
  fora (`mesRef` + listener de `mousedown`).
- **Badge "EM ANDAMENTO" no lugar de "JANELA ABERTA"** (01/10/2026,
  `lib/risco.ts`): texto do badge de Status da linha pra banda `jan`
  (ETA em 3-7 dias) mudou — pedido direto, "janela aberta" confundia. O
  nome do card na faixa de risco continua "Próximos 7 dias", só o badge
  da linha mudou.
- **Skeleton de carga** (25/09/2026): `components/ui/skeleton.tsx` +
  `components/table-skeleton.tsx` (`TableSkeletonRows`, uma coluna por tipo:
  `pill`/`twoLine`/`bar`/`none`) substituem o "Carregando…" das tabelas
  enquanto `loading` é verdadeiro. Larguras determinísticas (sem
  `Math.random`, evita erro de hidratação). Cor: token `--vt-sk`.
- **Captação manual também busca `/clientes`** (22/09/2026), pra sugerir
  cliente cadastrado (nome/apelido) enquanto digita e pré-preencher o CNPJ
  ao escolher uma sugestão — campo continua livre pra digitar qualquer
  nome não cadastrado, nunca trava a tela.
- **Despachante virou `Select` com as 4 opções do sistema antigo**
  (`LOGMAIS`/`NIRRON`/`ATHENA`/`AUDAZ`, `lib/despachante.ts`) + "+ novo
  despachante" pra digitar outro nome — a migração tinha isso como campo de
  texto livre, uma regressão do `<select>` original. **Limitação de teste
  conhecida:** o popup desse `Select` (`@base-ui/react`) não abre via
  clique em jsdom (sem layout real — a mesma limitação já valia,
  silenciosamente, pros selects de Regime/Atracação/Parceiro, nenhum
  testado dessa forma). A cobertura em
  `captacoes/__tests__/page.test.tsx` usa o prefill por query string pra
  exercitar o valor inicial em vez de abrir o popup.
