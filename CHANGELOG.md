# Changelog — captacao-web

Mudanças relevantes deste frontend. Não é histórico de commit — só o que
importa pra quem quer entender a evolução do sistema sem ler `git log`.

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
