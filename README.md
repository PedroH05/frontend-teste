# captacao-web

Frontend (Next.js) do sistema de Captação Inteligente da Valetrade. Fala
com o backend real (`captacao-api`, repositório separado) por HTTP — nunca
acessa banco de dado direto, só o Supabase Auth para login/logout.

Documentação completa: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, shadcn
(`@base-ui/react`), `@supabase/supabase-js` (só autenticação), Vitest +
Testing Library.

## Pré-requisitos

- Node.js 18+
- Uma instância do `captacao-api` rodando (local ou remota) e um projeto
  Supabase (mesmo usado pelo backend, para login)

## Configuração

```bash
npm install
cp .env.example .env.local
```

Preencha o `.env.local`:

| Variável | De onde vem | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | Só o SDK de login |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key | Só o SDK de login (não é segredo) |
| `NEXT_PUBLIC_API_URL` | URL do `captacao-api` (local: `http://localhost:3000`, ou a porta que ele estiver usando) | Toda chamada de dado de negócio |

## Execução local

```bash
npm run dev
```

Abre em `http://localhost:3000` (ou a próxima porta livre, se a 3000 já
estiver ocupada pelo backend — nesse caso ajuste `NEXT_PUBLIC_API_URL`
de acordo).

## Testes

```bash
npm test
```

## Lint

```bash
npm run lint
```

## Estrutura principal

```
src/
  app/
    login/           tela de login
    (authed)/         rotas autenticadas (carteira, clientes, captações, histórico, dashboard)
  components/
    app-shell.tsx     sidebar, navegação, tema
    row-actions.tsx   par de ícones editar/excluir, padrão em toda tabela
  lib/
    api.ts            cliente HTTP pro captacao-api
    supabase.ts        SDK do Supabase (só auth)
    mock-mode.ts / mock-backend.ts   modo demo, ver abaixo
```

## Autenticação

Login via Supabase Auth SDK, direto do navegador — a sessão fica em
`localStorage`. Toda chamada de dado de negócio (`lib/api.ts`) injeta o JWT
dessa sessão no header `Authorization`; o backend valida. Sem sessão
válida, a chamada à API retorna `401` e a tela redireciona pro login.

## Modo demo

Existe um modo de demonstração (link "Ver demonstração" na tela de login)
que navega o app inteiro **sem nenhum backend real** — todas as chamadas
são respondidas por um backend falso em memória (`lib/mock-backend.ts`,
dados fixos em `lib/mock-data.ts`). Nada digitado nesse modo é salvo de
verdade. Existe pra permitir mostrar/testar a interface sem depender de
banco de dados ou backend no ar. Detalhe completo em
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#modo-demo).

## Documentação relacionada

Arquitetura cruzando frontend + backend (fluxo completo, decisões da
migração em si) fica no repositório do backend:
`../captacao-api/migration-plan/` (histórico) e
`../captacao-api/docs/ARCHITECTURE.md` (visão viva do sistema todo).
