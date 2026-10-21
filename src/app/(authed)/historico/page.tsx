'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronsUpDown,
  Plus,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch, ApiError } from '@/lib/api';
import type { Captacao } from '@/lib/types';
import { shortTerm } from '@/lib/risco';
import { formatData } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Paginacao } from '@/components/paginacao';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/ship-scene';
import { FiltroPeriodo, estaNoPeriodo, type Periodo } from '@/components/filtro-periodo';
import { ListaConteineres } from '@/components/lista-conteineres';
import { HblCartao } from '@/components/hbl-cartao';
import { TableSkeletonRows } from '@/components/table-skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Comportamento portado de captacao-valetrade/public/index.html
// (renderHistorico, setHistDia, setHistStatus). Ver
// migration-plan/features/historico/CURRENT_BEHAVIOR.md e
// migration-plan/prompts/05-historico.md. Sem rota de API própria — lê
// GET /captacoes (03-captacoes) e filtra no client, igual ao original.
type StatusFiltro = 'todos' | 'conc' | 'efet' | 'and';

function categoriaDe(stage: string | null): Exclude<StatusFiltro, 'todos'> {
  if (stage === 'SAIU_TERMINAL') return 'conc';
  if (stage === 'EFETIVA') return 'efet';
  return 'and';
}

const STAGE_LABEL: Record<string, string> = {
  SAIU_TERMINAL: 'Concluído',
  EFETIVA: 'Efetivado',
};

const PAGE_SIZE = 5;

type SortKey = 'registrado' | 'eta';

function despValido(desp: string | null): string | undefined {
  return desp && Number.isNaN(Number(desp)) ? desp : undefined;
}

// Dia/hora sempre no fuso local — `createdAt` vem em UTC, e uma captação
// das 22h no Brasil não pode cair no grupo do dia seguinte.
function dataValida(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function chaveDia(iso: string | null): string {
  const d = dataValida(iso);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dataLocal(iso: string | null): string {
  const d = dataValida(iso);
  return d ? d.toLocaleDateString('pt-BR') : '—';
}

function horaDe(iso: string | null): string {
  const d = dataValida(iso);
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function rotuloDia(iso: string | null): string {
  const d = dataValida(iso);
  if (!d) return 'Sem data';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);
  const diff = Math.round((hoje.getTime() - dia.getTime()) / 86_400_000);
  const nome = diff === 0 ? 'Hoje' : diff === 1 ? 'Ontem' : DIAS_SEMANA[d.getDay()];
  return `${nome} · ${d.toLocaleDateString('pt-BR')}`;
}

export default function HistoricoPage() {
  const router = useRouter();
  const [captacoes, setCaptacoes] = useState<Captacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Dois critérios de ordenação: Registrado em (padrão) e ETA — pedido
  // 17/09/2026 (antes só dava pra ordenar por Registrado em, ETA não tinha
  // opção nenhuma). sortDir 1 = crescente (mais antigo/ETA mais distante
  // primeiro), -1 = decrescente (mais recente/ETA mais próxima primeiro) —
  // mesma convenção da Carteira. Troca de coluna sempre começa
  // decrescente, igual já era o padrão de "Registrado em".
  const [sortKey, setSortKey] = useState<SortKey>('registrado');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(-1);
    }
  }
  // Filtro de/até (pedido 13/10/2026) — substitui o antigo input de dia
  // único. Sem período aplicado, mostra tudo (era o antigo padrão "Tudo") —
  // alternador Hoje/Tudo saiu de vez (pedido 15/10/2026): o preset "Hoje" já
  // está dentro deste mesmo filtro e faz a mesma coisa.
  const [periodo, setPeriodo] = useState<Periodo>({ inicio: null, fim: null });
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  // Clicar em qualquer ponto do processo (pedido 23/09/2026, mesmo padrão da
  // Carteira) — leva direto pro passo 7 (Revisão) do formulário, que já
  // mostra tudo (inclusive todos os BLs) e já tem editar-por-seção e
  // excluir. Substitui o drawer de detalhe usado antes.
  function handleRowClick(c: Captacao) {
    router.push(`/captacoes?edit=${c.id}&step=6`);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Captacao[]>('/captacoes');
      setCaptacoes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Busca no mount — setState só depois do await dentro de load().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const linhas = useMemo(() => {
    let rows = [...captacoes];
    if (periodo.inicio && periodo.fim) {
      rows = rows.filter((c) => {
        const d = c.createdAt ? new Date(c.createdAt) : null;
        return d && !Number.isNaN(d.getTime()) && estaNoPeriodo(d, periodo.inicio!, periodo.fim!);
      });
    }
    // Por padrão, data de registro mais recente primeiro — inclusive sem
    // período aplicado. O original ordenava por ETA (index.html:1551), mas
    // pedido do Pedro em 16/09/2026: captação sem ETA (ou ETA distante)
    // ficava perdida no fim de uma lista paginada, difícil de achar logo
    // depois de criar. Mudança deliberada de comportamento, ver
    // docs/DECISIONS.md. Ordenar por ETA continua disponível clicando na
    // coluna (pedido 17/09/2026) — sem ETA conta como o valor mais antigo,
    // então continua indo pro fim independente da direção.
    const valorDeOrdenacao = (c: Captacao) => (sortKey === 'eta' ? (c.eta ?? '') : c.createdAt);
    rows.sort((a, b) => {
      const va = valorDeOrdenacao(a);
      const vb = valorDeOrdenacao(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
    });
    if (statusFiltro !== 'todos') {
      rows = rows.filter((c) => categoriaDe(c.stage) === statusFiltro);
    }
    if (busca) {
      const q = busca.trim().toLowerCase();
      rows = rows.filter((c) => JSON.stringify(c).toLowerCase().includes(q));
    }
    return rows;
  }, [captacoes, periodo, statusFiltro, busca, sortKey, sortDir]);

  // Volta pra página 1 sempre que o filtro muda o conjunto exibido — senão
  // dá pra ficar numa página que não existe mais (ex.: filtrou e sobrou só
  // 1 página, mas você tava na 4). Ajuste durante o render (não em efeito)
  // pra não gerar uma renderização em cascata — ver
  // https://react.dev/learn/you-might-not-need-an-effect.
  const [filtroAnterior, setFiltroAnterior] = useState({ periodo, statusFiltro, busca, sortKey, sortDir });
  if (
    filtroAnterior.periodo !== periodo ||
    filtroAnterior.statusFiltro !== statusFiltro ||
    filtroAnterior.busca !== busca ||
    filtroAnterior.sortKey !== sortKey ||
    filtroAnterior.sortDir !== sortDir
  ) {
    setFiltroAnterior({ periodo, statusFiltro, busca, sortKey, sortDir });
    setPagina(1);
  }

  const totalPaginas = Math.max(1, Math.ceil(linhas.length / PAGE_SIZE));
  const linhasPagina = useMemo(
    () => linhas.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
    [linhas, pagina],
  );


  // Tabela agrupada por dia de registro (HANDOFF seção 3) — só quando a
  // ordem é por "Registrado em"; ordenado por ETA, dias de registro
  // misturados não fariam sentido como grupo. A contagem do grupo é do
  // dia inteiro (no filtro atual), não só do pedaço que cabe na página.
  const agruparPorDia = sortKey === 'registrado';
  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of linhas) {
      const k = chaveDia(c.createdAt);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [linhas]);

  const primeiraLinha = linhas.length ? (pagina - 1) * PAGE_SIZE + 1 : 0;
  const ultimaLinha = Math.min(pagina * PAGE_SIZE, linhas.length);

  function sortHead(k: SortKey, label: string) {
    const ativo = sortKey === k;
    const Seta = !ativo ? ArrowUpDown : sortDir === 1 ? ArrowUp : ArrowDown;
    return (
      <TableHead
        className={cn(
          'h-11 cursor-pointer text-xs select-none hover:text-foreground',
          ativo ? 'font-semibold text-primary' : 'font-medium text-muted-foreground',
        )}
        aria-sort={ativo ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'}
        onClick={() => toggleSort(k)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <Seta className={cn('size-3', !ativo && 'opacity-40')} aria-hidden="true" />
        </span>
      </TableHead>
    );
  }

  const thCls = 'h-11 text-xs font-medium text-muted-foreground';

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6 p-6 sm:p-8 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>Gestão</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Histórico</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Histórico</h1>
          <p className="text-sm text-muted-foreground">
            Registro completo de tudo que já foi captado (todos os períodos)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-sm">
            <span className="font-semibold text-foreground tabular-nums">{linhas.length}</span>
            captações
          </span>
          <Button className="h-10 px-4" onClick={() => router.push('/captacoes')}>
            <Plus />
            Nova captação
          </Button>
        </div>
      </header>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <section aria-label="Captações" className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-1 text-[15px] font-semibold">Captações</h2>
            <FiltroPeriodo value={periodo} onChange={setPeriodo} />
            <label className="relative">
              <span className="sr-only">Filtrar por status</span>
              <select
                className="h-10 appearance-none rounded-lg border bg-background pr-9 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as StatusFiltro)}
              >
                <option value="todos">Todos os status</option>
                <option value="efet">Efetivado</option>
                <option value="and">Em andamento</option>
              </select>
              <ChevronsUpDown
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </label>
          </div>
          <label className="flex h-10 w-[260px] max-w-full items-center gap-2 rounded-lg border bg-background px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Buscar no histórico</span>
            <input
              placeholder="Buscar cliente, BL, navio…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>

        <Table className="vt-tabela-compacta">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className={thCls}>Status</TableHead>
              <TableHead className={thCls}>Cliente</TableHead>
              {sortHead('registrado', 'Registrado em')}
              {sortHead('eta', 'ETA')}
              <TableHead className={cn('vt-extra-col', thCls)}>HBL</TableHead>
              <TableHead className={cn('vt-extra-col', thCls)}>Container</TableHead>
              <TableHead className={thCls}>CE</TableHead>
              <TableHead className={thCls}>Despachante</TableHead>
              <TableHead className={thCls}>Atracação → Parceiro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeletonRows columns={['pill', 'twoLine', 'bar', 'bar', 'bar', 'bar', 'bar', 'bar', 'bar']} />
            ) : linhas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <EmptyState title="Histórico vazio" subtitle="As captações aparecem aqui conforme forem feitas." />
                </TableCell>
              </TableRow>
            ) : (
              linhasPagina.map((c, i) => {
                const dia = chaveDia(c.createdAt);
                const novoGrupo = agruparPorDia && (i === 0 || chaveDia(linhasPagina[i - 1].createdAt) !== dia);
                const status = STAGE_LABEL[c.stage ?? ''] ?? 'Em andamento';
                const n = porDia.get(dia) ?? 0;
                return (
                  <Fragment key={c.id}>
                    {novoGrupo && (
                      <TableRow data-slot="grupo-dia" className="bg-muted/60 hover:bg-muted/60">
                        <TableHead scope="colgroup" colSpan={9} className="h-9 text-left text-xs">
                          <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                            {rotuloDia(c.createdAt)}
                            <span className="font-normal text-muted-foreground">
                              — {n} {n === 1 ? 'captação' : 'captações'}
                            </span>
                          </span>
                        </TableHead>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell
                        tabIndex={0}
                        className="cursor-pointer py-3.5"
                        onClick={() => handleRowClick(c)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleRowClick(c);
                          }
                        }}
                      >
                        <StatusBadge k={categoriaDe(c.stage)} label={status} />
                      </TableCell>
                      <TableCell className="max-w-[190px] text-sm">
                        <div className="flex flex-col">
                          <span title={c.cli ?? undefined} className="truncate font-semibold">
                            {c.cli}
                          </span>
                          <span title={c.referencia ?? undefined} className="truncate font-mono text-xs text-muted-foreground">
                            {c.referencia}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap tabular-nums">
                        {dataLocal(c.createdAt)}
                        <span className="text-muted-foreground"> · {horaDe(c.createdAt)}</span>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap tabular-nums">{formatData(c.eta)}</TableCell>
                      <TableCell className="vt-extra-col text-sm">
                        <HblCartao valor={c.bl} />
                      </TableCell>
                      <TableCell className="vt-extra-col text-sm">
                        <ListaConteineres valor={c.container} />
                      </TableCell>
                      <TableCell className="font-mono text-[13px] whitespace-nowrap text-foreground/80">
                        {c.ce || '—'}
                      </TableCell>
                      <TableCell className="text-sm leading-snug">
                        {despValido(c.despachante) ?? <span className="font-semibold text-destructive">inválido</span>}
                      </TableCell>
                      <TableCell className="text-sm leading-snug">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-medium">{shortTerm(c.terminalDescarga) || '—'}</span>
                          <ArrowRight className="size-3.5 text-primary" aria-label="para" />
                          {shortTerm(c.terminalCaptado) || '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
        {!loading && linhas.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5 text-[13px] text-muted-foreground">
            <span className="tabular-nums">
              Mostrando {primeiraLinha}–{ultimaLinha} de {linhas.length} processos · Página {pagina} de {totalPaginas}
            </span>
            <Paginacao pagina={pagina} totalPaginas={totalPaginas} onChange={setPagina} />
          </div>
        )}
      </section>
    </div>
  );
}
