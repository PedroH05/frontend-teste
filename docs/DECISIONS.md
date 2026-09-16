# Decisões arquiteturais — captacao-web

Registro de decisões **a partir de 15/09/2026**. Para o histórico de ADRs
da migração em si, ver `../../captacao-api/migration-plan/architecture/DECISIONS.md`
— aquele arquivo é histórico e não recebe mais entradas novas; este aqui é
o que vive daqui pra frente, específico das decisões deste frontend.

Formato de cada entrada: Contexto → Problema → Opções consideradas →
Escolha → Motivo → Consequências.

---

## 2026-09-16 — Histórico "Tudo" ordena por data de registro, não por ETA

**Contexto.** O sistema antigo (`index.html`, `renderHistorico`) ordena a
aba "Tudo" do Histórico por `eta` decrescente; foi portado assim,
fielmente, na migração.

**Problema.** Achado testando com dado real de produção: uma captação sem
ETA (ou com ETA distante) cai pro fim da lista ordenada por ETA. Com a
paginação de 12 por página (adicionada depois do sistema antigo, que
mostrava até 500 linhas sem paginar), isso empurra a captação recém-criada
pra uma página distante — quem acabou de cadastrar não a vê sem procurar.
No sistema antigo isso incomodava menos por não ter paginação (bastava
rolar a página até achar).

**Opções consideradas.**
1. Manter ordenação por ETA (igual ao original).
2. Ordenar "Tudo" por data de registro (`createdAt`) decrescente — igual ao
   que "Hoje"/filtro por dia já faz.

**Escolha.** Opção 2.

**Motivo.** Pedido do Pedro ao testar com dado real. Ordenar por ETA fazia
mais sentido sem paginação (a lista inteira estava visível, ETA ajudava a
ver o que está mais perto de vencer). Com paginação, "onde foi parar o que
acabei de criar" é a pergunta mais comum, e `createdAt` responde isso
direto — quem quiser ver por urgência de ETA ainda pode usar Carteira ou
Dashboard.

**Consequências.**
- Toda captação nova aparece no topo da página 1 de "Tudo", igual já
  acontecia no filtro "Hoje".
- Ordenar por urgência de ETA deixou de existir no Histórico — quem
  precisar disso usa a Carteira (que já ordena por risco).
- Teste de regressão em `__tests__/page.test.tsx` cobre exatamente o caso
  (captação sem ETA mais recente aparece antes de uma antiga com ETA).
