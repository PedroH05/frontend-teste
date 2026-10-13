# Valetrade Captação — Handoff do redesign

Redesign das telas do app de captação. **Paleta e componentes shadcn mantidos.**
As telas de referência estão em `telas/*.dc.html`: cada arquivo é HTML com estilos inline e serve como **referência visual**. **Não** é código pra copiar. Implementar com os componentes shadcn/ui e Tailwind que o projeto já usa.

## 1. Tokens

### `globals.css` (variáveis shadcn, HSL)

```css
:root {
  --background: 240 4.8% 95.9%;      /* #F4F4F5 fundo pérola */
  --foreground: 240 5.9% 10%;        /* #18181B */
  --card: 0 0% 100%;                 /* #FFFFFF */
  --card-foreground: 240 5.9% 10%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 5.9% 10%;
  --primary: 350 85% 42%;            /* #C8102E vermelho Valetrade */
  --primary-foreground: 0 0% 100%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.9% 40.4%; /* #63636B (contraste AA em branco e no pérola) */
  --accent: 351 82% 96%;             /* #FDECEE vermelho suave */
  --accent-foreground: 350 85% 35%;  /* #A50D26 */
  --destructive: 350 85% 42%;
  --destructive-foreground: 0 0% 100%;
  --border: 240 5.9% 90%;            /* #E4E4E7 */
  --input: 240 5.9% 90%;
  --ring: 350 85% 42%;
  --radius: 0.75rem;                 /* cards 12px; botões/inputs 8px */

  /* Sidebar (shadcn Sidebar) */
  --sidebar-background: 230 14% 8%;  /* #121318 */
  --sidebar-foreground: 240 4.9% 83.9%; /* #D4D4D8 */
  --sidebar-primary: 350 85% 42%;    /* item ativo */
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 233 13% 13%;     /* #1C1D24 hover / busca */
  --sidebar-accent-foreground: 0 0% 98%;
  --sidebar-border: 233 9% 16%;      /* #26272E */
  --sidebar-ring: 350 85% 42%;

  /* Status (adicionar) */
  --success: 142 72% 29%;            /* #15803D */
  --success-soft: 141 79% 93%;       /* #DCFCE7 */
  --success-text: 143 64% 24%;       /* #166534 */
  --warning: 26 90% 37%;             /* #B45309 */
  --warning-soft: 48 96% 89%;        /* #FEF3C7 */
  --warning-text: 23 83% 31%;        /* #92400E */
  --warning-border: 48 97% 77%;      /* #FDE68A */
}
```

Registrar `success*` e `warning*` no `tailwind.config` (`colors.success.DEFAULT`, `colors.success.soft` etc.).

### Tipografia
- **Geist** (texto) e **Geist Mono** (CE, CNPJ, HBL, contêiner, referência). No Next: pacote `geist` → `GeistSans` / `GeistMono`.
- Título da página: 28px / 600 / tracking -0.02em. Título de card: 15–16px / 600. Corpo: 14px. Label: 13px / 500. Meta: 12px muted.
- Números de KPI: 32–34px / 600, `tabular-nums`.

### Medidas
- Botões e inputs com 40px de altura (`h-10`). Itens da sidebar com 44px. Botões só com ícone: 40×40 com `aria-label`.
- Cards: `rounded-xl border bg-card shadow-sm`, padding de 20–24px. Gap entre seções: 24px. Padding da página: `px-10 py-8`, conteúdo com `max-w-[1240px] mx-auto`.

## 2. Layout global
- `SidebarProvider` + `Sidebar` (shadcn), sempre escura nos dois temas.
  - Topo: logo e "VALETRADE / Captação Inteligente", com botão de recolher.
  - Botão "Buscar… Ctrl K" (pode abrir um `CommandDialog`).
  - Grupos com `SidebarGroupLabel`: OPERAÇÃO (Carteira, com badge de contagem), GESTÃO (Dashboard, Clientes, Histórico, Anotações), SISTEMA (Config).
  - Rodapé: avatar com ponto online, nome, e-mail truncado e botão Sair.
  - Item ativo: `bg-primary text-white`.
- Cabeçalho de página: breadcrumb (`Breadcrumb`), h1, subtítulo `text-muted-foreground` e ações à direita.

## 3. Telas e componentes

| Tela | Arquivo | Componentes shadcn |
|---|---|---|
| Carteira | `Main.dc.html` | Card (4 KPIs com ícone, `Progress` e % da carteira), Card de busca (Input com ícone, Button, chips de sugestão = Button outline `rounded-full`), Tabs de status com contagem, Input de busca, Button `variant="outline"` com borda tracejada (filtros Despachante e Período → `Popover`), Table, Badge de status, DropdownMenu de ações, Pagination |
| Dashboard | `Dashboard.dc.html` | Tabs Hoje/Semana/Mês/Total, 5 Cards KPI com Badge de período, gráfico de área (shadcn Chart/Recharts) com o valor do mês em destaque, listas de barras (posição, nome, barra, valor, %) |
| Clientes | `Clientes.dc.html` | Table com avatar de iniciais, CNPJ mono, apelidos como Badge outline, ações editar/excluir (`AlertDialog` pra excluir). Ao lado, Card "Adicionar cliente": Label + Input, CNPJ com máscara, tag input de apelidos |
| Histórico | `Historico.dc.html` | Tabs Hoje/Tudo, DatePicker (`Popover` + `Calendar`), Select de status, busca. Tabela **agrupada por dia** (linha separadora "Hoje · 13/10/2026 — 4 captações"), hora junto da data |
| Anotações | `Anotacoes.dc.html` | Lista com busca e botão "+", item ativo `bg-accent`. Editor: título como input grande, Textarea, rodapé "Salva ao sair do campo" e contador de caracteres. Abrir quadro e Excluir |
| Config | `Config.dc.html` | `Switch` "Mostrar o nome do status" com prévia ao vivo do badge, `RadioGroup` em cards pra Tema visual (Novo / Clássico) |
| Editar captação | `EditarCaptacao.dc.html` | Wizard de 7 etapas (ver seção 4) |
| Revisão | `Revisao.dc.html` | Etapa 7 do wizard (ver seção 5) |

### Status (Badge)
- Efetivado/Efetiva: `bg-success-soft text-success-text` com ícone de check.
- Em andamento / Próximos 7 dias: warning.
- Crítico: `bg-accent text-primary`.
- Config "Mostrar o nome do status" desligado: mostra só o ícone num círculo, com `Tooltip` trazendo o nome.

## 4. Wizard "Editar captação"

Layout em duas colunas, que vira uma só no mobile:
- **Esquerda: stepper vertical** (Card). Em cima, `Progress` com "X de 6 etapas completas". Embaixo, uma linha por etapa: círculo, nome e **resumo do que foi preenchido** (ex.: "CMA CGM IRON · 1 contêiner"). Clicar numa linha leva pra etapa.
- **Direita:** Card com cabeçalho "ETAPA N DE 7", título e descrição, e o formulário da etapa. Embaixo, uma barra de ações em Card: Sair, Anterior (desabilitado na etapa 1), espaço, Excluir (ghost vermelho, com `AlertDialog`), Próximo (some na etapa 7) e **Salvar** (primary).

**Estados do círculo, calculados a partir dos dados e não da posição:**
- `atual`: `bg-primary text-white ring-4 ring-primary/15` com o número.
- `completa` (todos os campos preenchidos): `bg-success text-white` com check.
- `com vazios`: `bg-warning-soft text-warning-text border-warning-border` com o número. O resumo fica em âmbar e diz "N campos vazios".
- `pendente` (Revisão, quando não é a atual): branco com borda.

Isso corrige o bug do original, em que etapas incompletas ficavam vermelhas igual à atual e a Revisão aparecia verde desde o início.

**Etapas e campos:**
1. Identificação: CNPJ (mono, com máscara) e Cliente (Combobox preenchido pelo CNPJ), Referência (mono).
2. Carga:
   - ETA (DatePicker mostrando "em Nd").
   - Navio.
   - Qtde de contêineres (input numérico com botões − e +).
   - Contêineres (tag input mono).
   - Validação embaixo: "N contêineres informados — bate com a quantidade" (verde), ou aviso âmbar se não bater.
3. Aduana: CE Mercante (mono), HBL (mono), Regime (Select), Despachante (Select).
4. Terminal: Atracação (Select), seta e Parceiro captado (Select), lado a lado como um fluxo.
5. Situação: Status (Select com ponto colorido), Observação (Textarea, opcional), Checkbox em card "Marcar como tabela pública" com descrição.
6. Carregamento: Data de carregamento e Data de chegada (DatePickers), Transportadora. Mostra um Alert âmbar quando está tudo vazio: "Dá pra salvar e completar depois".
7. Revisão: ver seção 5.

## 5. Revisão (etapa 7) — prioridade

São três blocos, do mais importante pro menos:
1. **Resumo do processo** (Card):
   - Cabeçalho `bg-muted/50`: cliente (22px/600), referência em mono dentro de uma caixinha, CNPJ e Badge de status.
   - Embaixo, grade de 4 células com label, valor e meta:
     - Navio: ETA e "em Nd".
     - Contêineres: quantidade e números.
     - Rota: Atracação → Parceiro.
     - Despacho: Despachante e Regime.
2. **O que ficou vazio** (Alert âmbar, renderizado **só se houver campos vazios**):
   - Título "N etapas com campos vazios" e "Dá pra salvar assim e completar depois".
   - Uma linha por etapa, com badge "N · Etapa", a lista dos campos vazios e um botão "Preencher" que leva pra etapa.
3. **Ficha completa** (Card):
   - Cabeçalho com "X de Y campos preenchidos".
   - Uma linha por etapa: círculo de status e nome à esquerda, grade de `dl` com os campos no meio, "Editar" à direita.
   - Campo vazio: ponto âmbar e "Vazio" em `text-warning-text`, em vez de "não informado" em itálico.

Tudo isso deve ser **derivado do estado do formulário** (um único objeto, ex. com react-hook-form), sem nada fixo no código: completude por etapa, contagem de campos, lista de vazios e resumos do stepper.

## 6. A confirmar com o time (adicionado no redesign, não existe hoje)
- Atalho Ctrl K (busca global) na sidebar.
- Botão "Painel de TV" no Dashboard e "Exportar" no Histórico.
- Filtros Despachante e Período na tabela da Carteira.
- Paginação numerada (hoje só Anterior/Próxima).
- Textos de apoio das etapas e dicas embaixo dos campos (ex.: "Preenchido pelo CNPJ.").
- O gráfico "Contêineres por mês" do mock usa valores estimados de mai–set. Usar os dados reais.
- Quais campos são obrigatórios pra salvar. O mock trata todos os vazios como opcionais.
