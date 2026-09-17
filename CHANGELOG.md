# Changelog — captacao-web

Mudanças relevantes deste frontend. Não é histórico de commit — só o que
importa pra quem quer entender a evolução do sistema sem ler `git log`.

## 2026-09-16 — Paginação na tabela de Processos da Carteira

- Mesmo tamanho e padrão visual do Histórico. Pedido direto, sem relação
  com performance dessa vez. Ver `docs/ARCHITECTURE.md`.
- Tamanho de página (Histórico e Carteira) reduzido de 12 para **10**, a
  pedido, logo em seguida.

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
