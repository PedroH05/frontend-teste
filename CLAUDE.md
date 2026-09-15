@AGENTS.md

# CLAUDE.md — captacao-web

Instruções de desenvolvimento e manutenção para este repositório.
Documentação completa fica em `docs/ARCHITECTURE.md` — este arquivo é só um
guia de trabalho, não repita conteúdo de lá aqui.

> `@AGENTS.md` acima é gerado automaticamente pelo `next dev` a cada
> execução (avisa sobre diferenças desta versão do Next.js em relação ao
> que modelos de IA aprenderam em treino) — não é documentação deste
> projeto, é infraestrutura do próprio Next. Não remova a linha nem edite
> `AGENTS.md` manualmente, ele é reescrito sozinho.

## O que é este projeto

Frontend (Next.js) do sistema de Captação Inteligente da Valetrade. Recebeu
as telas do cockpit `captacao-valetrade` (antes um `index.html` monolítico)
e fala com o backend real (`captacao-api`, repo separado) por HTTP — nunca
acessa banco direto.

## Stack

Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, shadcn
(`@base-ui/react`), `@supabase/supabase-js` (só autenticação), Vitest +
Testing Library.

## Estrutura principal

```
src/
  app/
    login/            tela de login (Supabase Auth) — única rota fora do grupo autenticado
    (authed)/          grupo de rotas autenticadas, layout compartilhado (AppShell)
      carteira/ clientes/ captacoes/ historico/ dashboard/
      layout.tsx        renderiza <AppShell> — precisa ser layout de verdade, não componente recriado por página
  components/
    app-shell.tsx       sidebar + indicador deslizante + tema + logout
    row-actions.tsx     par de ícones editar/excluir, padrão em toda tabela
    ui/                 primitivos shadcn
  lib/
    api.ts              cliente HTTP pra captacao-api (injeta o JWT em toda chamada)
    supabase.ts          SDK do Supabase, só para auth
    mock-mode.ts / mock-backend.ts / mock-data.ts   modo demo (ver docs/ARCHITECTURE.md)
    theme.ts             modo escuro
docs/                    documentação viva deste repo
```

## Comandos importantes

```bash
npm run dev      # dev local (Turbopack)
npm run build    # build de produção
npm test         # Vitest + Testing Library
npm run lint     # eslint
```

## Padrões importantes

- **Toda tela autenticada busca dado no client** (`useEffect` + `apiFetch`),
  nunca em Server Component — o JWT da sessão vive em `localStorage`, um
  Server Component não tem como montar o header `Authorization`. Isso é
  decisão deliberada, não esquecimento (ver
  `../captacao-api/migration-plan/architecture/DECISIONS.md`).
- **Ícones de editar/excluir**: sempre `<RowActions />`
  (`components/row-actions.tsx`) — não recrie o par de botões numa tela
  nova, é o padrão único da aplicação.
- **Design tokens**: cores/espaçamento seguem as variáveis `--vt-*`
  definidas em `globals.css` — não hardcode cor nova fora desse sistema, e
  toda cor nova precisa de par claro/escuro (ver seção dark mode em
  `docs/ARCHITECTURE.md`).
- **Nunca acesse Supabase/banco direto pra dado de negócio** — só
  `lib/supabase.ts` (login/logout) tem esse acesso; tudo mais passa por
  `apiFetch` → `captacao-api`.
- Toda tela com lógica de filtro/formulário relevante ganha teste
  (`__tests__/page.test.tsx`, Vitest + Testing Library) — siga o padrão das
  telas existentes.

## Onde fica a documentação

- `docs/ARCHITECTURE.md` — estrutura de pastas, `AppShell`, design system,
  modo escuro, modo demo, decisões relevantes.
- `docs/DECISIONS.md` — ADRs novos deste frontend, a partir de agora.
- `CHANGELOG.md` — mudanças relevantes.
- Documentação de arquitetura **cruzando os dois repos** (fluxo completo
  frontend↔backend↔banco, decisões da migração em si) fica em
  `../captacao-api/migration-plan/` — histórico, não documentação viva.

## Regras de segurança

- **Nunca commitar `.env.local`** (já está no `.gitignore`).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` **não é segredo** (é pública por design,
  já embutida em outro app do mesmo sistema) — mas ainda assim não deve ir
  em texto solto fora de `.env.local`/variáveis de ambiente do host.
- Dado de negócio (captações, clientes) nunca deve passar por chamada
  direta ao Supabase a partir daqui — só pela `captacao-api`.
- Modo demo (`mock-mode.ts`) nunca deve gravar nem ler dado real — confira
  isso ao adicionar uma rota nova no `mock-backend.ts`.

## Regras de Git

- Commits e push são iniciativa do usuário — só commite/dê push quando ele
  pedir explicitamente naquela ocasião.
- Nunca force-push nem reescreva histórico já publicado sem pedido
  explícito.

## Quando atualizar documentação — regra permanente

**Documentação faz parte da implementação.** Depois de qualquer mudança,
avalie e atualize antes de considerar a tarefa concluída:

| Mudança | Atualizar |
|---|---|
| Nova tela/funcionalidade | `docs/ARCHITECTURE.md` |
| Mudança estrutural (rotas, layout, `AppShell`) | `docs/ARCHITECTURE.md` |
| Novo componente padrão (tipo `RowActions`) | `docs/ARCHITECTURE.md` |
| Mudança no design system (tokens, dark mode) | `docs/ARCHITECTURE.md` |
| Mudança no modo demo (novas rotas mockadas) | `docs/ARCHITECTURE.md`, seção Modo Demo |
| Decisão arquitetural | novo registro em `docs/DECISIONS.md` |
| Mudança relevante pro projeto | `CHANGELOG.md` |

Nunca espere o usuário pedir "documenta isso". Se não tiver certeza se algo
mudou de verdade, confirme no código antes de escrever — nunca documente
por suposição.
