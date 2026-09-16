# Decisões arquiteturais — captacao-web

Registro de decisões **a partir de 15/09/2026**. Para o histórico de ADRs
da migração em si, ver `../../captacao-api/migration-plan/architecture/DECISIONS.md`
— aquele arquivo é histórico e não recebe mais entradas novas; este aqui é
o que vive daqui pra frente, específico das decisões deste frontend.

Formato de cada entrada: Contexto → Problema → Opções consideradas →
Escolha → Motivo → Consequências.

---

## 2026-09-16 — 401 desloga e manda pro login sozinho

**Contexto.** Uma funcionária abriu o site já "logada" (sessão antiga no
navegador) e o app travou mostrando "Token inválido ou expirado" sem
carregar nada — precisou o Pedro orientar por fora a sair e entrar de novo
pra funcionar.

**Problema.** Toda rota da API exige token; um `401` só acontece por sessão
ruim (token expirado, assinado com chave antiga, revogado), nunca por regra
de negócio. Antes, `apiFetch` só devolvia a mensagem de erro — cabia à
pessoa entender que precisava deslogar manualmente.

**Escolha.** `apiFetch` agora reage a `401` chamando `signOut()` do Supabase
e mandando pra `/login` sozinho (recarga cheia da página, não
`router.push`), antes de lançar o erro pro chamador.

**Motivo.** É código de biblioteca (`lib/api.ts`), fora de componente/hook
— não dá pra usar `useRouter()`. Recarga cheia também limpa qualquer estado
do Next que ficou preso com a sessão ruim, não só troca a URL.

**Consequências.**
- Ninguém mais precisa ser orientado a "sai e entra de novo" — o app faz
  isso sozinho.
- Só reage a `401` especificamente; erro de negócio (`404`, `409`, etc.)
  continua só virando `ApiError`, sem deslogar ninguém.
- Não foi confirmada a causa exata da sessão antiga ficar guardada no
  navegador dela (suspeita: sessão de teste anterior, sem investigação
  mais funda) — a correção é deixar o sintoma se resolver sozinho, não uma
  correção da causa raiz.

## 2026-09-16 — `apiFetch` não quebra mais em resposta sem corpo

**Contexto.** Testando exclusão com dado real de produção: o botão excluir
"funcionava" (o registro sumia do banco), mas a linha continuava na tela
até dar F5, e um "Erro ao excluir" aparecia. Chegou a ser investigado como
cache da Vercel (não era — esse `Cache-Control: no-store` no backend segue
correto e vale por si, só não era a causa deste bug).

**Problema.** `DELETE /captacoes/:id` e `DELETE /clientes/:id` respondem
`200` com corpo **vazio** (`Content-Length: 0`). `apiFetch` sempre fazia
`return res.json()` sem checar se havia corpo — `JSON.parse('')` lança
`SyntaxError: Unexpected end of JSON input`. Isso acontecia **dentro** do
próprio `await apiFetch(...)`, então o código teoricamente correto que
viria depois (atualizar a tela) nunca rodava — o `catch` do chamador pegava
essa exceção e mostrava só a mensagem genérica de erro.

**Opções consideradas.**
1. Fazer toda rota `DELETE` do backend devolver algum corpo (ex.: `{}` ou o
   registro excluído).
2. Corrigir `apiFetch` pra tratar corpo vazio como sucesso sem valor.

**Escolha.** Opção 2.

**Motivo.** É o ponto único de toda chamada HTTP do frontend — corrige o
problema pra qualquer rota futura que devolva corpo vazio (padrão comum em
`DELETE`), sem precisar lembrar de ajustar cada controller do backend.

**Consequências.**
- `apiFetch` lê a resposta como texto primeiro e só faz `JSON.parse` se não
  estiver vazia; senão devolve `undefined`.
- Toda tela que faz `await apiFetch(DELETE)` sem usar o valor de retorno
  (todas, hoje) não muda de comportamento — só para de lançar por engano.
- Testes novos em `src/lib/api.test.ts` cobrem corpo vazio (200 e 204),
  corpo JSON normal, e que erro (`!res.ok`) continua virando `ApiError`.

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
