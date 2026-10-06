'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { Cliente, CockpitRow, ImportResult } from '@/lib/types';
import { BANDS, banda, diasAte, dLabel, fmtEta, shortTerm, type Banda } from '@/lib/risco';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { formatData, formatDataHora } from '@/lib/format';
import { apelidoCliente } from '@/lib/apelido';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
// renderKpis, renderAlert, ask, exportOficial, captar, marcarCaptado,
// efetivar, trackOpen). Ver migration-plan/features/carteira/CURRENT_BEHAVIOR.md
// e migration-plan/prompts/04-carteira.md.
//
// Client Component (não Server Component) — ver
// migration-plan/architecture/DECISIONS.md, decisão "Telas autenticadas
// buscam dado no client": o JWT vive em localStorage, nunca chega ao
// servidor do Next.

const ALERT_MIN_KEY = 'alertMin';
const TT_CONTAINER = (n: string) => `https://www.track-trace.com/container/${n}`;
const TT_BOL = (n: string) => `https://www.track-trace.com/bol/${n}`;

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
const MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

// Ícone por banda de risco nos cards da Carteira (pedido 02/10/2026, "dar
// mais vida" ao tema Novo — ver artefato "Dar mais vida ao tema Novo",
// opção C escolhida). Só aparece sob o tema Novo (globals.css,
// `.vt-risk-tile-ic` escondido no Clássico).
const BAND_ICON: Record<Banda['k'], typeof AlertTriangle> = {
  prej: AlertTriangle,
  jan: Clock,
  and: RefreshCw,
  efet: CheckCircle2,
  conc: CheckCircle2,
  prog: Clock,
};

export default function CarteiraPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CockpitRow[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterBand, setFilterBand] = useState<string | null>(null);
  const [chipFiltro, setChipFiltro] = useState<'critico' | 'semana' | 'semdesp' | 'aluzen' | null>(null);

  function toggleChip(v: typeof chipFiltro) {
    setChipFiltro((f) => (f === v ? null : v));
  }
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
  const [ask, setAsk] = useState('');
  const [askAnswer, setAskAnswer] = useState<React.ReactNode>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [alertMin, setAlertMin] = useState(false);

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

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage (sistema externo), só existe no cliente
      setAlertMin(localStorage.getItem(ALERT_MIN_KEY) === '1');
    } catch {
      // ignora — só é conveniência de UI, não dado crítico.
    }
  }, []);

  function toggleAlertMin() {
    setAlertMin((v) => {
      const next = !v;
      try {
        localStorage.setItem(ALERT_MIN_KEY, next ? '1' : '0');
      } catch {
        // ignora — só é conveniência de UI, não dado crítico.
      }
      return next;
    });
  }

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
    if (chipFiltro === 'critico') list = list.filter(({ b }) => b.k === 'prej');
    else if (chipFiltro === 'semana') list = list.filter(({ b }) => ['prej', 'jan'].includes(b.k));
    else if (chipFiltro === 'semdesp') list = list.filter(({ r }) => !r.regime || r.regime === 'AGUARDANDO');
    else if (chipFiltro === 'aluzen') list = list.filter(({ r }) => r.cli.toLowerCase().includes('aluzen'));
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
  }, [enriquecidas, busca, filterBand, mesFiltro, chipFiltro, sortKey, sortDir]);

  const totalContainers = linhas.reduce((s, { r }) => s + (Number(r.qtd) || 1), 0);

  // Paginação da tabela de processos — mesmo padrão do Histórico. Volta pra
  // página 1 sempre que um filtro muda o conjunto exibido, senão dá pra
  // ficar numa página que não existe mais. Ajuste durante o render (não em
  // efeito) — ver https://react.dev/learn/you-might-not-need-an-effect.
  const [pagina, setPagina] = useState(1);
  const [filtroAnterior, setFiltroAnterior] = useState({ filterBand, mesFiltro, chipFiltro, busca, sortKey, sortDir });
  if (
    filtroAnterior.filterBand !== filterBand ||
    filtroAnterior.mesFiltro !== mesFiltro ||
    filtroAnterior.chipFiltro !== chipFiltro ||
    filtroAnterior.busca !== busca ||
    filtroAnterior.sortKey !== sortKey ||
    filtroAnterior.sortDir !== sortDir
  ) {
    setFiltroAnterior({ filterBand, mesFiltro, chipFiltro, busca, sortKey, sortDir });
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

  function handleAsk(override?: string) {
    const raw = (override ?? ask).trim();
    const code = raw.toUpperCase().replace(/\s+/g, '');
    if (!/\s/.test(raw) && /\d/.test(raw) && /^[A-Z0-9./-]{6,}$/.test(code)) {
      const isCont = /^[A-Z]{4}\d{7}$/.test(code);
      const url = isCont ? TT_CONTAINER(code) : TT_BOL(code);
      const hit = enriquecidas.find(
        ({ r }) =>
          (r.cont || '').toUpperCase().includes(code) ||
          (r.bl || '').toUpperCase() === code ||
          (r.blCap || '').toUpperCase() === code,
      );
      setAskAnswer(
        <div>
          <p>
            {isCont ? (
              <>
                Detectei um <b>container</b> <span className="font-mono">{code}</span>.
              </>
            ) : (
              <>
                Parece um <b>BL / código</b> <span className="font-mono">{code}</span>.
              </>
            )}
          </p>
          {hit && (
            <p className="mt-2">
              📦 Está na sua carteira: <b>{hit.r.cli} {hit.r.ref.replace(hit.r.cli, '').trim()}</b> —{' '}
              {hit.b.t}, ETA {fmtEta(hit.r.eta)} ({dLabel(hit.d)}).
            </p>
          )}
          <Button className="mt-3" size="sm" onClick={() => window.open(url, '_blank', 'noopener')}>
            Rastrear no track-trace
          </Button>
        </div>,
      );
      return;
    }
    const q = raw.toLowerCase();
    let res = enriquecidas;
    let intro = '';
    const clientesConhecidos = ['tecno', 'aluzen', 'gv', 'huesker', 'faster', 'star', 'hb'];
    const cli = clientesConhecidos.find((c) => q.includes(c));
    if (/prejuí|prejui|iminente|crític|critic/.test(q)) {
      res = enriquecidas.filter(({ b }) => b.k === 'prej');
      intro = `${res.length} em estado crítico (doc na mão ou ETA ≤2d sem captação):`;
    } else if (/despachante|regime|sem /.test(q)) {
      res = enriquecidas.filter(({ r }) => !r.regime || r.regime === 'AGUARDANDO');
      intro = `${res.length} com regime "Aguardando"/vazio:`;
    } else if (cli) {
      res = enriquecidas.filter(
        ({ r }) => r.cli.toLowerCase() === cli || r.ref.toLowerCase().includes(cli),
      );
      intro = `${res.length} processo(s) de ${cli.toUpperCase()}:`;
    } else if (/semana|captar/.test(q)) {
      res = enriquecidas.filter(({ b }) => ['prej', 'jan'].includes(b.k));
      intro = `Faltam captar ${res.length} nesta semana (≤7 dias):`;
    } else {
      res = enriquecidas.filter(({ b }) => ['prej', 'jan'].includes(b.k));
      intro = 'Ação nos próximos 7 dias:';
    }
    setAskAnswer(
      <div>
        <p>{intro}</p>
        {res.length === 0 ? (
          <p style={{ color: 'var(--vt-muted)' }}>Nada encontrado.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {res.slice(0, 8).map(({ r, b, d }) => (
              <li key={r.capId ?? r.bl ?? r.ref}>
                • <b>{r.cli} {r.ref.replace(r.cli, '').trim()}</b> — {b.t}, {dLabel(d)}, {r.regime || 'sem regime'}
              </li>
            ))}
          </ul>
        )}
      </div>,
    );
  }

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

  const glassBtn =
    'vt-glass-strong rounded-[11px] border border-[var(--vt-line)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--vt-ink)] shadow-[var(--vt-sh)] transition hover:-translate-y-px';
  const primaryBtn = 'vt-btn-primary rounded-[11px] px-3.5 py-2 text-[12.5px] font-semibold transition hover:-translate-y-px';

  return (
    <div className="p-6 sm:p-8" style={{ color: 'var(--vt-ink)' }}>
      <div className="mx-auto max-w-[1400px] space-y-5">
        <div className="flex flex-wrap items-end gap-3.5">
          <div>
            <h1 className="text-[21px] font-bold tracking-tight">Carteira de captação</h1>
            <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--vt-muted)' }}>
              {linhas.length} processos · {totalContainers} contêineres
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="ghost" className={glassBtn} onClick={handleExport}>
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
              variant="ghost"
              className={glassBtn}
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? 'Lendo a planilha…' : 'Importar Logcomex'}
            </Button>
            <Button variant="ghost" className={primaryBtn} onClick={() => router.push('/captacoes')}>
              + Nova captação
            </Button>
          </div>
        </div>

        {importSummary && (
          <div className="vt-glass rounded-[16px] p-4 text-[13px]" style={{ background: 'var(--vt-bg-efet)', color: 'var(--vt-c-efet)' }}>
            <b>{importSummary.processados}</b> processados · <b>{importSummary.porCnpj}</b> por CNPJ ·{' '}
            <b>{importSummary.provaveis}</b> prováveis · <b>{importSummary.ignorados}</b> ignorados
          </div>
        )}

        {alerta.prej.length > 0 && (
          <div
            className="relative overflow-hidden rounded-[16px] p-[13px_18px] text-[#f3efe8] shadow-[var(--vt-sh-lg)]"
            style={{ background: 'linear-gradient(135deg, rgba(38,36,31,.96), rgba(58,26,24,.94))' }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="vt-pulse h-[9px] w-[9px] shrink-0 rounded-full"
                style={{ background: 'var(--vt-c-prej)' }}
              />
              {!alertMin && (
                <p className="text-[13px] leading-[1.5]">
                  <b className="text-white">{alerta.prej.length} processo(s)</b> viram tabela pública hoje se não forem
                  efetivados —{' '}
                  {alerta.prej.slice(0, 2).map(({ r, d }, i) => (
                    <span key={r.capId ?? r.bl} style={{ color: '#ff9e93', fontWeight: 700 }}>
                      {i > 0 && ' e '}
                      {r.cli} {r.ref.replace(r.cli, '').trim()} ({dLabel(d)})
                    </span>
                  ))}
                  .
                </p>
              )}
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterBand('prej')}
                  className="rounded-[9px] px-3 py-1.5 text-[11.5px] font-bold whitespace-nowrap"
                  style={{ background: 'var(--vt-c-prej)', color: '#fff' }}
                >
                  Ver os {alerta.prej.length} críticos →
                </button>
                <button
                  type="button"
                  onClick={toggleAlertMin}
                  className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[6px] text-[12px] transition"
                  style={{ background: 'rgba(255,255,255,.12)', color: '#ffb9b0' }}
                >
                  {alertMin ? '▴' : '▾'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-stretch gap-2">
          <div className="vt-glass grid flex-1 grid-cols-2 gap-px overflow-hidden sm:grid-cols-4" style={{ background: 'var(--vt-line)' }}>
            {BANDS.map((b) => {
              const n = contagens[b.k] ?? 0;
              const active = filterBand === b.k;
              const Icon = BAND_ICON[b.k];
              return (
                <button
                  key={b.k}
                  type="button"
                  onClick={() => setFilterBand((f) => (f === b.k ? null : b.k))}
                  className={`vt-risk-tile relative flex items-center gap-3 p-[13px_14px] text-left transition${
                    b.k === 'prej' && n > 0 ? ' vt-risk-tile-pulse' : ''
                  }`}
                  style={{
                    background: active ? '#fff' : 'var(--vt-glass-strong)',
                    boxShadow: active ? `inset 0 -3px 0 var(--vt-c-${b.k})` : undefined,
                  }}
                >
                  <span
                    className="vt-risk-tile-ic"
                    style={{ background: `var(--vt-bg-${b.k})`, color: `var(--vt-c-${b.k})` }}
                  >
                    <Icon size={18} />
                  </span>
                  <span>
                    <div className="text-[25px] leading-none font-extrabold tracking-tight" style={{ color: `var(--vt-c-${b.k})` }}>
                      {loading ? <Skeleton className="h-[25px] w-9" /> : n}
                    </div>
                    <div className="mt-1.5 text-[10.5px] font-semibold" style={{ color: 'var(--vt-muted)' }}>
                      {b.l}
                    </div>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filtro de mês (pedido 01/10/2026): botão calendário, separado
              dos cards de risco — filtra a carteira inteira por mês de
              criação (`createdAt`), combinável com o card selecionado. */}
          <div className="relative" ref={mesRef}>
            <button
              type="button"
              aria-label="Filtrar por mês de criação"
              aria-expanded={mesAberto}
              onClick={() => setMesAberto((v) => !v)}
              className="flex h-full w-[58px] flex-col items-center justify-center gap-1 rounded-[14px] p-2 text-[10px] font-bold transition"
              style={{
                background: mesFiltro ? 'var(--vt-c-efet)' : 'var(--vt-glass-strong)',
                color: mesFiltro ? '#fff' : 'var(--vt-c-efet)',
                border: '1px solid var(--vt-line)',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M8 3v4M16 3v4M3 10h18" />
              </svg>
              {mesFiltro && MESES_ABREV[Number(mesFiltro.slice(5, 7)) - 1]}
            </button>
            {mesAberto && (
              <div
                className="absolute top-[calc(100%+8px)] right-0 z-10 w-[190px] rounded-[12px] p-[6px]"
                style={{ background: 'var(--vt-surface)', border: '1px solid var(--vt-line)', boxShadow: 'var(--vt-sh-lg)' }}
              >
                {mesesDisponiveis.length === 0 && (
                  <div className="p-2 text-[12px]" style={{ color: 'var(--vt-muted)' }}>
                    Nenhum mês ainda
                  </div>
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
                      className="flex w-full items-center justify-between rounded-[7px] px-2 py-1.5 text-[12.5px] transition"
                      style={{
                        background: sel ? 'var(--vt-bg-efet)' : 'transparent',
                        color: sel ? 'var(--vt-c-efet)' : 'var(--vt-ink)',
                        fontWeight: sel ? 700 : 500,
                      }}
                    >
                      <span>
                        {MESES_PT[Number(mes) - 1]} / {ano}
                      </span>
                      <span className="font-mono text-[11px]" style={{ color: 'var(--vt-muted)' }}>
                        {qtd}
                      </span>
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
                    className="mt-1 w-full rounded-[7px] px-2 py-1.5 text-center text-[11.5px] font-semibold underline"
                    style={{ color: 'var(--vt-muted)' }}
                  >
                    limpar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="vt-glass p-[15px_17px]">
          <label className="mb-[9px] block text-[12px] font-bold">
            Busca rápida — cliente, container ou BL
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="ex.: o que falta captar da Tecno? — ou cole um container/BL"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              className="vt-glass-strong rounded-[11px] border-[var(--vt-line)] text-[13px]"
            />
            <Button variant="ghost" className={primaryBtn} onClick={() => handleAsk()}>
              Buscar
            </Button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(
              [
                ['critico', 'crítico', 'var(--vt-c-prej)'],
                ['semana', 'falta captar essa semana', 'var(--vt-c-jan)'],
                ['semdesp', 'sem despachante/regime', 'var(--vt-muted)'],
                ['aluzen', 'processos da Aluzen', 'var(--vt-ink)'],
              ] as [Exclude<typeof chipFiltro, null>, string, string][]
            ).map(([id, label, dot]) => (
              <span
                key={id}
                className="vt-chip"
                onClick={() => toggleChip(id)}
                style={
                  chipFiltro === id
                    ? { background: 'var(--vt-bg-prej)', borderColor: 'transparent', color: 'var(--vt-red)', fontWeight: 700 }
                    : undefined
                }
              >
                <span
                  className="mr-1.5 inline-block h-[6px] w-[6px] rounded-full align-middle"
                  style={{ background: dot }}
                />
                {label}
              </span>
            ))}
          </div>
          {askAnswer && <div className="mt-3 text-[13px] leading-relaxed">{askAnswer}</div>}
        </div>

        {error && (
          <p className="text-[13px] font-semibold" style={{ color: 'var(--vt-c-prej)' }}>
            {error}
          </p>
        )}

        <div className="vt-glass overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-[14px_18px]" style={{ borderBottom: '1px solid var(--vt-line2)' }}>
            <h3 className="text-[14px] font-bold">
              Processos
              {(filterBand || busca || chipFiltro) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterBand(null);
                    setBusca('');
                    setChipFiltro(null);
                  }}
                  className="ml-2 text-[11px] font-semibold"
                  style={{ color: 'var(--vt-muted)' }}
                >
                  ✕ limpar filtro
                </button>
              )}
            </h3>
            <Input
              placeholder="buscar cliente, BL, navio…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="ml-auto w-[200px] rounded-[10px] text-[12.5px]"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: 'var(--vt-line)' }}>
                {(
                  [
                    ['pr', 'Status'],
                    ['cli', 'Cliente / Ref.'],
                  ] as [SortKey, string][]
                ).map(([key, label]) => (
                  <TableHead
                    key={key}
                    className="cursor-pointer text-[11px] font-semibold tracking-[.05em] uppercase select-none"
                    style={{ color: sortKey === key ? 'var(--vt-red)' : 'var(--vt-muted)' }}
                    onClick={() => toggleSort(key)}
                  >
                    {label}{' '}
                    <span style={{ opacity: sortKey === key ? 1 : 0.35 }}>
                      {sortKey === key ? (sortDir === 1 ? '▲' : '▼') : '↕'}
                    </span>
                  </TableHead>
                ))}
                <TableHead
                  className="cursor-pointer text-[11px] font-semibold tracking-[.05em] uppercase select-none"
                  style={{ color: sortKey === 'registrado' ? 'var(--vt-red)' : 'var(--vt-muted)' }}
                  onClick={() => toggleSort('registrado')}
                >
                  Registrado em{' '}
                  <span style={{ opacity: sortKey === 'registrado' ? 1 : 0.35 }}>
                    {sortKey === 'registrado' ? (sortDir === 1 ? '▲' : '▼') : '↕'}
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer text-[11px] font-semibold tracking-[.05em] uppercase select-none"
                  style={{ color: sortKey === 'dias' ? 'var(--vt-red)' : 'var(--vt-muted)' }}
                  onClick={() => toggleSort('dias')}
                >
                  ETA / Prazo{' '}
                  <span style={{ opacity: sortKey === 'dias' ? 1 : 0.35 }}>
                    {sortKey === 'dias' ? (sortDir === 1 ? '▲' : '▼') : '↕'}
                  </span>
                </TableHead>
                {['HBL', 'Container', 'Qtde', 'Regime'].map((h) => (
                  <TableHead
                    key={h}
                    className="vt-extra-col text-[11px] font-semibold tracking-[.05em] uppercase"
                    style={{ color: 'var(--vt-muted)' }}
                  >
                    {h}
                  </TableHead>
                ))}
                <TableHead className="text-[11px] font-semibold tracking-[.05em] uppercase" style={{ color: 'var(--vt-muted)' }}>
                  CE
                </TableHead>
                <TableHead
                  className="cursor-pointer text-[11px] font-semibold tracking-[.05em] uppercase select-none"
                  style={{ color: sortKey === 'desp' ? 'var(--vt-red)' : 'var(--vt-muted)' }}
                  onClick={() => toggleSort('desp')}
                >
                  Despachante{' '}
                  <span style={{ opacity: sortKey === 'desp' ? 1 : 0.35 }}>
                    {sortKey === 'desp' ? (sortDir === 1 ? '▲' : '▼') : '↕'}
                  </span>
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-[.05em] uppercase" style={{ color: 'var(--vt-muted)' }}>
                  Atracação → Parceiro
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeletonRows columns={['pill', 'twoLine', 'bar', 'bar', 'bar', 'bar', 'bar', 'bar', 'bar', 'bar', 'bar', 'none']} />
              ) : linhas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12}>
                    <EmptyState
                      title={busca || filterBand || chipFiltro ? 'Nenhum processo com este filtro' : 'Radar vazio'}
                      subtitle={
                        busca || filterBand || chipFiltro
                          ? 'Tente limpar a busca ou o filtro de risco.'
                          : <>Clique em <b>Importar Logcomex</b> para carregar a planilha da semana.</>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                linhasPagina.map(({ r, b, d }) => (
                  <TableRow key={r.capId ?? `${r.bl}-${r.ref}`} style={{ borderColor: 'var(--vt-line)' }}>
                    <TableCell
                      tabIndex={0}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(r);
                        }
                      }}
                    >
                      <span className={`vt-band b-${b.k}`}>{b.t}</span>
                    </TableCell>
                    <TableCell className="text-[13px]">
                      <div className="flex flex-col">
                        <span className="font-bold" style={{ color: 'var(--vt-red)' }} title={r.cli}>
                          {apelidoCliente(r.cli, r.cnpj, clientes)}
                          {r.prov && (
                            <span className="vt-band ml-1" style={{ background: 'var(--vt-bg-jan)', color: 'var(--vt-c-jan)' }}>
                              provável
                            </span>
                          )}
                        </span>
                        <span style={{ color: 'var(--vt-muted)' }}>
                          {r.ref.replace(r.cli, '').trim() || r.ref}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap" title={formatDataHora(r.createdAt)}>
                      {formatData(r.createdAt)}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {fmtEta(r.eta)} · {dLabel(d)}
                    </TableCell>
                    <TableCell className="vt-extra-col text-[13px] font-mono">{r.blCap || r.bl || '—'}</TableCell>
                    <TableCell className="vt-extra-col text-[13px] font-mono">{r.cont || '—'}</TableCell>
                    <TableCell className="vt-extra-col text-[13px]">{r.qtd || '—'}</TableCell>
                    <TableCell className="vt-extra-col text-[13px]">{r.regime || '—'}</TableCell>
                    <TableCell className="text-[13px]">{r.ce || '—'}</TableCell>
                    <TableCell className="text-[13px]">
                      {despValido(r.desp) ?? <span style={{ color: 'var(--vt-c-prej)', fontWeight: 600 }}>inválido</span>}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {shortTerm(r.atrac) || '—'} <span style={{ color: 'var(--vt-red)', fontWeight: 700 }}>→</span> {shortTerm(r.parc) || '—'}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!loading && linhas.length > 0 && (
            <div
              className="flex items-center justify-between px-[18px] py-3 text-[12px]"
              style={{ borderTop: '1px solid var(--vt-line2)', color: 'var(--vt-muted)' }}
            >
              <span>
                Página {pagina} de {totalPaginas} · {linhas.length} processos
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  className="vt-glass-strong rounded-[9px] border border-[var(--vt-line)] px-2.5 py-1 text-[12px] font-semibold text-[var(--vt-ink)] shadow-[var(--vt-sh)] transition hover:-translate-y-px disabled:opacity-40"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  ‹ Anterior
                </Button>
                <Button
                  variant="ghost"
                  className="vt-glass-strong rounded-[9px] border border-[var(--vt-line)] px-2.5 py-1 text-[12px] font-semibold text-[var(--vt-ink)] shadow-[var(--vt-sh)] transition hover:-translate-y-px disabled:opacity-40"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                >
                  Próxima ›
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
