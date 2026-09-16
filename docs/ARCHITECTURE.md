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
- **Paginação client-side no Histórico e na Carteira** (10 itens/página,
  mesmo tamanho nas duas — era 12, reduzido a pedido em 16/09/2026). No Histórico foi implementada como tentativa de
  resolver uma lentidão percebida ao navegar pra essa tela; a causa raiz
  real acabou sendo a busca redundante de `/carteira` no `AppShell` a cada
  navegação (ver acima), não o volume de linhas da tabela — a paginação
  ficou como melhoria de UX de qualquer forma, mas não deve ser tratada
  como "a" correção de performance se um problema parecido reaparecer.
  Na Carteira (16/09/2026, pedido direto) foi puro pedido de UX pra tabela
  de Processos, sem relação com performance. Nas duas, a página volta pra 1
  sempre que um filtro muda o conjunto exibido (ajuste durante o render,
  não em efeito — ver comentário no código).
