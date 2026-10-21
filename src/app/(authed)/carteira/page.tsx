'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { Cliente, CockpitRow, ImportResult } from '@/lib/types';
import { BANDS, banda, diasAte, dLabel, fmtEta, shortTerm } from '@/lib/risco';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatData, formatDataHora } from '@/lib/format';
import { apelidoCliente } from '@/lib/apelido';
import { ListaConteineres } from '@/components/lista-conteineres';
import { HblCartao } from '@/components/hbl-cartao';
import { StatusBadge, STATUS_ESTILO } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Paginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { EmptyState } from '@/components/ship-scene';
import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeletonRows } from '@/components/table-skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Comportamento portado de captacao-valetrade/public/index.html (render,
// renderKpis, renderAlert, exportOficial, captar, marcarCaptado,
// efetivar, trackOpen). Ver migration-plan/features/carteira/CURRENT_BEHAVIOR.md
// e migration-plan/prompts/04-carteira.md.
//
// Client Component (não Server Component) — ver
// migration-plan/architecture/DECISIONS.md, decisão "Telas autenticadas
// buscam dado no client": o JWT vive em localStorage, nunca chega ao
// servidor do Next.


function despValido(desp: string): string | undefined {
  return desp && Number.isNaN(Number(desp)) ? desp : undefined;
}

// Portado de COLS/setSort() no index.html original.
type SortKey = 'pr' | 'cli' | 'registrado' | 'dias' | 'regime' | 'desp' | 'navio';

const PAGE_SIZE = 5; // mesmo tamanho de página do Histórico

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function CarteiraPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CockpitRow[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterBand, setFilterBand] = useState<string | null>(null);
  // Padrão: registro mais recente primeiro — pedido 17/09/2026 (antes o
  // padrão era ETA mais urgente primeiro).
  const [sortKey, setSortKey] = useState<SortKey>('registrado');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(1);
    }
  }
  const [busca, setBusca] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtro de mês (pedido 01/10/2026: "ver o que foi feito no mês") — olha
  // `createdAt` (quando a captação foi registrada), não quando mudou de
  // status, e não some com o resto da carteira: é um filtro à parte, igual
  // ao filterBand, combinável com ele.
  const [mesFiltro, setMesFiltro] = useState<string | null>(null); // 'YYYY-MM'
  const [mesAberto, setMesAberto] = useState(false);
  const mesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mesAberto) return;
    function onClickFora(e: MouseEvent) {
      if (mesRef.current && !mesRef.current.contains(e.target as Node)) setMesAberto(false);
    }
    document.addEventListener('mousedown', onClickFora);
    return () => document.removeEventListener('mousedown', onClickFora);
  }, [mesAberto]);

  const [criticosAberto, setCriticosAberto] = useState(false);
  const criticosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!criticosAberto) return;
    function onClickFora(e: MouseEvent) {
      if (criticosRef.current && !criticosRef.current.contains(e.target as Node)) setCriticosAberto(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setCriticosAberto(false);
    }
    document.addEventListener('mousedown', onClickFora);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickFora);
      document.removeEventListener('keydown', onEsc);
    };
  }, [criticosAberto]);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ rows: CockpitRow[] }>('/carteira');
      setRows(data.rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar carteira');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  useEffect(() => {
    // Só pra trocar o nome do cliente pelo apelido cadastrado na exibição
    // (ver lib/apelido.ts) — busca própria, silenciosa: sem clientes
    // carregados, a Carteira segue mostrando o texto original normalmente.
    // Efeito declarado DEPOIS do que chama load() de propósito: nos testes,
    // o mock de apiFetch responde por ordem de chamada, não por rota — se
    // esse efeito rodasse primeiro, roubaria a resposta destinada a
    // /carteira (viu isso quebrar 7 testes ao inverter a ordem).
    let active = true;
    apiFetch<Cliente[]>('/clientes')
      .then((data) => {
        if (active) setClientes(data);
      })
      .catch(() => {
        // sem apelido — mostra o texto original, não é erro que trave a tela
      });
    return () => {
      active = false;
    };
  }, []);

  const enriquecidas = useMemo(
    () => rows.map((r) => ({ r, b: banda(r), d: diasAte(r.eta) })),
    [rows],
  );

  const contagens = useMemo(() => {
    const c: Record<string, number> = {};
    for (const { b } of enriquecidas) c[b.k] = (c[b.k] ?? 0) + 1;
    return c;
  }, [enriquecidas]);

  // Meses com captação criada, mais recente primeiro, com contagem — pro
  // popover do botão de calendário. 'YYYY-MM' ordena certo como texto.
  const mesesDisponiveis = useMemo(() => {
    const porMes = new Map<string, number>();
    for (const { r } of enriquecidas) {
      const chave = (r.createdAt ?? '').slice(0, 7);
      if (!chave) continue;
      porMes.set(chave, (porMes.get(chave) ?? 0) + 1);
    }
    return [...porMes.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [enriquecidas]);

  const linhas = useMemo(() => {
    let list = enriquecidas;
    if (filterBand) list = list.filter(({ b }) => b.k === filterBand);
    if (mesFiltro) list = list.filter(({ r }) => (r.createdAt ?? '').slice(0, 7) === mesFiltro);
    if (busca) {
      const q = busca.trim().toLowerCase();
      list = list.filter(({ r }) => JSON.stringify(r).toLowerCase().includes(q));
    }
    const val = (item: (typeof list)[number]): string | number => {
      switch (sortKey) {
        case 'pr':
          return item.b.pr;
        case 'cli':
          return item.r.cli.toLowerCase();
        case 'registrado':
          return item.r.createdAt ?? ''; // ISO ordena certo como texto
        case 'regime':
          return item.r.regime || 'zzz';
        case 'desp':
          return (item.r.desp || 'zzz').toLowerCase();
        case 'navio':
          return item.r.navio.toLowerCase();
        default:
          return item.d;
      }
    };
    return [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
    });
  }, [enriquecidas, busca, filterBand, mesFiltro, sortKey, sortDir]);

  const totalContainers = linhas.reduce((s, { r }) => s + (Number(r.qtd) || 1), 0);

  // Paginação da tabela de processos — mesmo padrão do Histórico. Volta pra
  // página 1 sempre que um filtro muda o conjunto exibido, senão dá pra
  // ficar numa página que não existe mais. Ajuste durante o render (não em
  // efeito) — ver https://react.dev/learn/you-might-not-need-an-effect.
  const [pagina, setPagina] = useState(1);
  const [filtroAnterior, setFiltroAnterior] = useState({ filterBand, mesFiltro, busca, sortKey, sortDir });
  if (
    filtroAnterior.filterBand !== filterBand ||
    filtroAnterior.mesFiltro !== mesFiltro ||
    filtroAnterior.busca !== busca ||
    filtroAnterior.sortKey !== sortKey ||
    filtroAnterior.sortDir !== sortDir
  ) {
    setFiltroAnterior({ filterBand, mesFiltro, busca, sortKey, sortDir });
    setPagina(1);
  }
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / PAGE_SIZE));
  const linhasPagina = useMemo(
    () => linhas.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
    [linhas, pagina],
  );

  // Só sobrou o alerta de crítico (pedido 01/10/2026: tirada a frase "Há N
  // na janela de 7 dias... com regime pendente" que aparecia quando não
  // havia nenhum crítico) — `jan`/`semReg` não tinham mais outro uso.
  const alerta = useMemo(() => {
    const prej = enriquecidas
      .filter(({ b }) => b.k === 'prej')
      .sort((a, b) => a.d - b.d);
    return { prej };
  }, [enriquecidas]);

  // Linha sem captação casada (embarque só da Logcomex) — clicar nela vai
  // pro fluxo de criar uma captação nova, pré-preenchida com o que já se
  // sabe do embarque (pedido 23/09/2026, ver handleRowClick).
  function captar(row: CockpitRow) {
    const params = new URLSearchParams();
    const set = (k: string, v?: string) => v && params.set(k, v);
    set('cli', row.cli);
    set('referencia', row.ref);
    set('eta', row.eta);
    set('navio', row.navio);
    set('ce', row.ce);
    set('bl', row.bl);
    set('container', row.cont);
    set('regime', row.regime || 'DTA');
    set('despachante', despValido(row.desp) ?? 'LOGMAIS');
    set('terminalDescarga', row.atrac || 'Santos Brasil');
    set('terminalCaptado', row.parc || 'ECOPORTO');
    set('cnpj', row.cnpj);
    router.push(`/captacoes?${params.toString()}`);
  }

  // Sem uso pelo mesmo motivo do captar() acima (14/09/2026).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function marcarCaptado(row: CockpitRow) {
    if (!confirm(`Marcar ${row.cli} como JÁ CAPTADO (efetivado)?`)) return;
    try {
      await apiFetch('/captacoes/captado', {
        method: 'POST',
        body: JSON.stringify({
          cli: row.cli,
          referencia: row.ref,
          eta: row.eta || undefined,
          terminalDescarga: row.atrac || undefined,
          terminalCaptado: row.parc || undefined,
          bl: row.bl || undefined,
          ce: row.ce || undefined,
          container: row.cont || undefined,
          quantidade: parseInt(row.qtd, 10) || undefined,
          navio: row.navio || undefined,
          despachante: despValido(row.desp),
          regime: row.regime || undefined,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao marcar como captado');
    }
  }

  // Sem uso desde que a coluna de ação virou só editar/excluir (11/09/2026)
  // — mantida de propósito, pode voltar a ser chamada se recuperarmos o
  // botão "Efetivar" mais tarde.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function efetivar(capId: number) {
    if (!confirm('Confirmar captação efetivada no terminal?')) return;
    try {
      await apiFetch(`/captacoes/${capId}/efetivar`, { method: 'PATCH' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao efetivar');
    }
  }

  // Clicar em qualquer ponto do processo (pedido 23/09/2026) — leva direto
  // pro passo 7 (Revisão) do formulário, que já mostra tudo e já tem
  // editar-por-seção e excluir. Sem captação casada, vai pro fluxo de criar
  // uma nova a partir do embarque (captar(), acima).
  function handleRowClick(r: CockpitRow) {
    if (r.capId) router.push(`/captacoes?edit=${r.capId}&step=6`);
    else captar(r);
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiFetch<ImportResult>('/import/logcomex', {
        method: 'POST',
        body: formData,
      });
      setImportSummary(result);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao ler o arquivo');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleExport() {
    try {
      const { apiFetch: fetchFn } = await import('@/lib/api');
      const captacoes = await fetchFn<
        {
          cli: string | null;
          referencia: string | null;
          eta: string | null;
          ce: string | null;
          bl: string | null;
          navio: string | null;
          container: string | null;
          quantidade: number | null;
          despachante: string | null;
          terminalDescarga: string | null;
          terminalCaptado: string | null;
          stage: string | null;
          cnpj: string | null;
          observacao: string | null;
        }[]
      >('/captacoes');
      if (!captacoes.length) {
        alert('Nenhuma captação para exportar ainda.');
        return;
      }
      const XLSX = await import('xlsx');
      const linhasExport = captacoes.map((c) => ({
        CNPJ: c.cnpj || '',
        'Cliente/ Referência': c.referencia || c.cli || '',
        ETA: (c.eta || '').slice(0, 10),
        CE: c.ce || '',
        HBL: c.bl || '',
        Navio: c.navio || '',
        Container: c.container || '',
        'Qtde de Cntr': c.quantidade || '',
        Despachante: c.despachante || '',
        Atracação: c.terminalDescarga || '',
        Parceiro: c.terminalCaptado || '',
        Captado: c.stage === 'EFETIVA' || c.stage === 'SAIU_TERMINAL' ? 'SIM' : 'PENDENTE',
        OBS: c.observacao || '',
      }));
      const ws = XLSX.utils.json_to_sheet(linhasExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Captação Oficial');
      XLSX.writeFile(wb, `Captacao_Oficial_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao exportar');
    }
  }

  const filtroAtivo = !!(filterBand || busca || mesFiltro);
  const totalCarteira = enriquecidas.length;
  const primeiraLinha = linhas.length ? (pagina - 1) * PAGE_SIZE + 1 : 0;
  const ultimaLinha = Math.min(pagina * PAGE_SIZE, linhas.length);

  function sortHead(k: SortKey, label: string) {
    const ativo = sortKey === k;
    const Seta = !ativo ? ArrowUpDown : sortDir === 1 ? ArrowUp : ArrowDown;
    return (
      <TableHead className="h-11 text-xs font-medium">
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={cn(
            'inline-flex items-center gap-1 hover:text-foreground',
            ativo ? 'font-semibold text-primary' : 'text-muted-foreground',
          )}
        >
          {label}
          <Seta className={cn('size-3', !ativo && 'opacity-40')} aria-hidden="true" />
        </button>
      </TableHead>
    );
  }

  const ABAS: { k: string | null; l: string; n: number }[] = [
    { k: null, l: 'Todos', n: totalCarteira },
    ...BANDS.map((b) => ({ k: b.k, l: b.l, n: contagens[b.k] ?? 0 })),
  ];

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6 p-6 sm:p-8 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>Operação</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Carteira</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Carteira de captação</h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            {linhas.length} processos · {totalContainers} contêineres
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Aviso de crítico como selo, no lugar da faixa vermelha com frase
              (pedido 21/10/2026, "me estressa" — artefato "Aviso de
              Críticos", opção A). Lista completa ao clicar, sem cortar nomes. */}
          {alerta.prej.length > 0 && (
            <div className="relative" ref={criticosRef}>
              <button
                type="button"
                aria-expanded={criticosAberto}
                onClick={() => setCriticosAberto((v) => !v)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-primary/25 bg-accent px-3.5 text-[13px] font-semibold text-accent-foreground transition hover:bg-primary/10"
              >
                <span className="vt-pulse size-2 rounded-full bg-primary" aria-hidden="true" />
                {alerta.prej.length} {alerta.prej.length === 1 ? 'crítico' : 'críticos'} hoje
                <ChevronDown className={cn('size-3.5 transition-transform', criticosAberto && 'rotate-180')} />
              </button>
              {criticosAberto && (
                <div
                  role="dialog"
                  aria-label="Processos críticos"
                  className="absolute top-[calc(100%+8px)] right-0 z-30 w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-1.5 text-left shadow-lg"
                >
                  <p className="px-2.5 pt-2 pb-1.5 text-xs text-muted-foreground">
                    Viram tabela pública se não forem efetivados hoje
                  </p>
                  <ul className="max-h-[320px] overflow-y-auto">
                    {alerta.prej.map(({ r, d }) => (
                      <li key={r.capId ?? `${r.bl}-${r.ref}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setCriticosAberto(false);
                            handleRowClick(r);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            <b className="font-semibold">{apelidoCliente(r.cli, r.cnpj, clientes)}</b>{' '}
                            <span className="font-mono text-xs text-muted-foreground">
                              {r.ref.replace(r.cli, '').trim() || r.ref}
                            </span>
                          </span>
                          <span className={cn('shrink-0 text-xs', d < 0 ? 'font-medium text-primary' : 'text-muted-foreground')}>
                            {dLabel(d)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      setCriticosAberto(false);
                      setFilterBand('prej');
                    }}
                    className="mt-1 flex w-full items-center justify-between rounded-lg border-t px-2.5 py-2 text-sm font-medium text-primary hover:bg-accent"
                  >
                    Filtrar a tabela pelos críticos
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              )}
            </div>
          )}
          <Button variant="outline" className="h-10 px-3.5" onClick={handleExport}>
            <Download />
            Exportar Captação Oficial
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={importing}
            aria-label="Selecionar planilha do Logcomex"
            onChange={(e) => handleImportFile(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            className="h-10 px-3.5"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload />
            {importing ? 'Lendo a planilha…' : 'Importar Logcomex'}
          </Button>
          <Button className="h-10 px-4" onClick={() => router.push('/captacoes')}>
            <Plus />
            Nova captação
          </Button>
        </div>
      </header>

      {importSummary && (
        <Alert className="border-success-soft bg-success-soft text-success-text">
          <CheckCircle2 />
          <AlertTitle>Planilha importada</AlertTitle>
          <AlertDescription className="text-success-text/90">
            <span>
              <b>{importSummary.processados}</b> processados · <b>{importSummary.porCnpj}</b> por CNPJ ·{' '}
              <b>{importSummary.provaveis}</b> prováveis · <b>{importSummary.ignorados}</b> ignorados
            </span>
          </AlertDescription>
        </Alert>
      )}

      <section aria-label="Resumo por status" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {BANDS.map((b) => {
          const n = contagens[b.k] ?? 0;
          const ativo = filterBand === b.k;
          const { cls, Icon } = STATUS_ESTILO[b.k];
          const pct = totalCarteira ? (n / totalCarteira) * 100 : 0;
          return (
            <button
              key={b.k}
              type="button"
              aria-pressed={ativo}
              onClick={() => setFilterBand((f) => (f === b.k ? null : b.k))}
              className={cn(
                'flex flex-col gap-3 rounded-xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                ativo && 'border-primary ring-2 ring-primary/20',
              )}
            >
              <span className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-muted-foreground">{b.l}</span>
                <span className={cn('flex size-8 items-center justify-center rounded-lg', cls)}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </span>
              <span className="text-[32px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                {loading ? <Skeleton className="h-8 w-12" /> : n}
              </span>
              <span className="flex flex-col gap-1.5">
                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      b.k === 'prej' ? 'bg-primary' : b.k === 'efet' ? 'bg-success' : 'bg-warning',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da carteira
                </span>
              </span>
            </button>
          );
        })}
      </section>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <section aria-label="Processos" className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[15px] font-semibold">Processos</h2>
            <div
              role="tablist"
              aria-label="Filtrar por status"
              className="inline-flex flex-wrap gap-0.5 rounded-lg bg-muted p-[3px]"
            >
              {ABAS.map((t) => {
                const sel = filterBand === t.k;
                return (
                  <button
                    key={t.l}
                    type="button"
                    role="tab"
                    aria-selected={sel}
                    onClick={() => setFilterBand(t.k)}
                    className={cn(
                      'inline-flex h-[30px] items-center gap-1.5 rounded-md px-2.5 text-[13px] transition',
                      sel ? 'bg-card font-semibold shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t.l}
                    <span className="text-xs text-muted-foreground tabular-nums">{t.n}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filtroAtivo && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground"
                onClick={() => {
                  setFilterBand(null);
                  setBusca('');
                  setMesFiltro(null);
                }}
              >
                <X />
                Limpar filtro
              </Button>
            )}
            <label className="flex h-10 w-[240px] max-w-full items-center gap-2 rounded-lg border bg-background px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Buscar na tabela</span>
              <input
                placeholder="Buscar cliente, BL, navio…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>

            {/* Filtro de mês (pedido 01/10/2026): filtra a carteira inteira
                por mês de criação (`createdAt`), combinável com o status. */}
            <div className="relative" ref={mesRef}>
              <Button
                variant="outline"
                aria-label="Filtrar por mês de criação"
                aria-expanded={mesAberto}
                onClick={() => setMesAberto((v) => !v)}
                className={cn(
                  'h-10 border-dashed px-3.5',
                  mesFiltro && 'border-solid border-primary/40 bg-accent text-primary hover:bg-accent',
                )}
              >
                <CalendarDays />
                {mesFiltro ? `${MESES_PT[Number(mesFiltro.slice(5, 7)) - 1]} / ${mesFiltro.slice(0, 4)}` : 'Mês'}
              </Button>
              {mesAberto && (
                <div className="absolute top-[calc(100%+6px)] right-0 z-20 w-[210px] rounded-lg border bg-popover p-1 shadow-md">
                  {mesesDisponiveis.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">Nenhum mês ainda</div>
                  )}
                  {mesesDisponiveis.map(([chave, qtd]) => {
                    const [ano, mes] = chave.split('-');
                    const sel = mesFiltro === chave;
                    return (
                      <button
                        key={chave}
                        type="button"
                        onClick={() => {
                          setMesFiltro(chave);
                          setMesAberto(false);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                          sel && 'bg-accent font-semibold text-primary hover:bg-accent',
                        )}
                      >
                        <span>
                          {MESES_PT[Number(mes) - 1]} / {ano}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">{qtd}</span>
                      </button>
                    );
                  })}
                  {mesFiltro && (
                    <button
                      type="button"
                      onClick={() => {
                        setMesFiltro(null);
                        setMesAberto(false);
                      }}
                      className="mt-1 w-full rounded-md px-2 py-1.5 text-center text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      limpar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <Table className="vt-tabela-compacta">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {sortHead('pr', 'Status')}
              {sortHead('cli', 'Cliente')}
              {sortHead('registrado', 'Registrado em')}
              {sortHead('dias', 'ETA / Prazo')}
              <TableHead className="vt-extra-col h-11 text-xs font-medium text-muted-foreground">HBL</TableHead>
              <TableHead className="vt-extra-col h-11 text-xs font-medium text-muted-foreground">Container</TableHead>
              <TableHead className="h-11 text-xs font-medium text-muted-foreground">CE</TableHead>
              {sortHead('desp', 'Despachante')}
              <TableHead className="h-11 text-xs font-medium text-muted-foreground">Atracação → Parceiro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeletonRows columns={['pill', 'twoLine', 'bar', 'bar', 'bar', 'bar', 'bar', 'bar', 'bar']} />
            ) : linhas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <EmptyState
                    title={busca || filterBand || mesFiltro ? 'Nenhum processo com este filtro' : 'Radar vazio'}
                    subtitle={
                      busca || filterBand || mesFiltro ? (
                        'Tente limpar a busca ou o filtro de risco.'
                      ) : (
                        <>
                          Clique em <b>Importar Logcomex</b> para carregar a planilha da semana.
                        </>
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              linhasPagina.map(({ r, b, d }) => (
                <TableRow key={r.capId ?? `${r.bl}-${r.ref}`}>
                  <TableCell
                    tabIndex={0}
                    className="cursor-pointer py-3.5"
                    onClick={() => handleRowClick(r)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(r);
                      }
                    }}
                  >
                    <StatusBadge k={b.k} label={b.t} />
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col">
                      <span className="font-semibold" title={r.cli}>
                        {apelidoCliente(r.cli, r.cnpj, clientes)}
                        {r.prov && (
                          <Badge className="ml-1.5 h-5 border-0 bg-warning-soft px-1.5 text-[10px] text-warning-text">
                            provável
                          </Badge>
                        )}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {r.ref.replace(r.cli, '').trim() || r.ref}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap tabular-nums" title={formatDataHora(r.createdAt)}>
                    {formatData(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap tabular-nums">
                      {fmtEta(r.eta)}
                      {r.eta && (
                        <span
                          className={cn(
                            'rounded-full px-2 py-px text-xs font-medium',
                            d >= 0 && d <= 2 ? 'bg-accent text-primary' : 'bg-muted text-foreground/80',
                          )}
                        >
                          {dLabel(d)}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="vt-extra-col text-sm">
                    <HblCartao valor={r.blCap || r.bl} />
                  </TableCell>
                  <TableCell className="vt-extra-col text-sm">
                    <ListaConteineres valor={r.cont} />
                  </TableCell>
                  <TableCell className="font-mono text-[13px] whitespace-nowrap text-foreground/80">
                    {r.ce || '—'}
                  </TableCell>
                  <TableCell className="text-sm leading-snug">
                    {despValido(r.desp) ?? <span className="font-semibold text-destructive">inválido</span>}
                  </TableCell>
                  <TableCell className="text-sm leading-snug">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-medium">{shortTerm(r.atrac) || '—'}</span>
                      <ArrowRight className="size-3.5 text-primary" aria-label="para" />
                      {shortTerm(r.parc) || '—'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
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
