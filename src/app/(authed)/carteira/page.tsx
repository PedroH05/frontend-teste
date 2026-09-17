'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { Cliente, CockpitRow, ImportResult } from '@/lib/types';
import { BANDS, banda, diasAte, dLabel, fmtEta, shortTerm } from '@/lib/risco';
import { formatData, formatDataHora } from '@/lib/format';
import { apelidoCliente } from '@/lib/apelido';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ship-scene';
import { RowActions } from '@/components/row-actions';
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

  const linhas = useMemo(() => {
    let list = enriquecidas;
    if (filterBand) list = list.filter(({ b }) => b.k === filterBand);
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
  }, [enriquecidas, busca, filterBand, chipFiltro, sortKey, sortDir]);

  const totalContainers = linhas.reduce((s, { r }) => s + (Number(r.qtd) || 1), 0);

  // Paginação da tabela de processos — mesmo padrão do Histórico. Volta pra
  // página 1 sempre que um filtro muda o conjunto exibido, senão dá pra
  // ficar numa página que não existe mais. Ajuste durante o render (não em
  // efeito) — ver https://react.dev/learn/you-might-not-need-an-effect.
  const [pagina, setPagina] = useState(1);
  const [filtroAnterior, setFiltroAnterior] = useState({ filterBand, chipFiltro, busca, sortKey, sortDir });
  if (
    filtroAnterior.filterBand !== filterBand ||
    filtroAnterior.chipFiltro !== chipFiltro ||
    filtroAnterior.busca !== busca ||
    filtroAnterior.sortKey !== sortKey ||
    filtroAnterior.sortDir !== sortDir
  ) {
    setFiltroAnterior({ filterBand, chipFiltro, busca, sortKey, sortDir });
    setPagina(1);
  }
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / PAGE_SIZE));
  const linhasPagina = useMemo(
    () => linhas.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
    [linhas, pagina],
  );

  const alerta = useMemo(() => {
    const prej = enriquecidas
      .filter(({ b }) => b.k === 'prej')
      .sort((a, b) => a.d - b.d);
    const jan = enriquecidas.filter(({ b }) => b.k === 'jan').length;
    const semReg = enriquecidas.filter(
      ({ r }) => !r.regime || r.regime === 'AGUARDANDO',
    ).length;
    return { prej, jan, semReg };
  }, [enriquecidas]);

  function handleAsk(override?: string) {
    const raw = (override ?? ask).trim();
    const code = raw.toUpperCase().replace(/\s+/g, '');
    if (!/\s/.test(raw) && /\d/.test(raw) && /^[A-Z0-9./-]{6,}$/.test(code)) {
      const isCont = /^[A-Z]{4}\d{7}$/.test(code);
      const url = isCont ? TT_CONTAINER(code) : TT_BOL(code);
      const hit = enriquecidas.find(
        ({ r }) => (r.cont || '').toUpperCase().includes(code) || (r.bl || '').toUpperCase() === code,
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

  // Sem uso desde que os botões Captar/captado saíram da coluna de ação
  // (14/09/2026) — mantida de propósito, pode voltar se recuperarmos esse
  // fluxo mais tarde.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  async function handleDelete(capId: number) {
    if (!confirm('Excluir este processo? Esta ação não pode ser desfeita.')) return;
    try {
      await apiFetch(`/captacoes/${capId}`, { method: 'DELETE' });
      // Tira da tela na hora — ver comentário equivalente em historico/page.tsx.
      setRows((prev) => prev.filter((r) => r.capId !== capId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
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

        {(alerta.prej.length > 0 || alerta.jan > 0 || alerta.semReg > 0) && (
          <div
            className="relative overflow-hidden rounded-[16px] p-[13px_18px] text-[#f3efe8] shadow-[var(--vt-sh-lg)]"
            style={{ background: 'linear-gradient(135deg, rgba(38,36,31,.96), rgba(58,26,24,.94))' }}
          >
            <div className="flex flex-wrap items-center gap-3">
              {alerta.prej.length > 0 && (
                <span
                  className="vt-pulse h-[9px] w-[9px] shrink-0 rounded-full"
                  style={{ background: 'var(--vt-c-prej)' }}
                />
              )}
              {!alertMin && (
                <p className="text-[13px] leading-[1.5]">
                  {alerta.prej.length > 0 ? (
                    <>
                      <b className="text-white">{alerta.prej.length} processo(s)</b> viram tabela pública hoje se não forem
                      efetivados —{' '}
                      {alerta.prej.slice(0, 2).map(({ r, d }, i) => (
                        <span key={r.capId ?? r.bl} style={{ color: '#ff9e93', fontWeight: 700 }}>
                          {i > 0 && ' e '}
                          {r.cli} {r.ref.replace(r.cli, '').trim()} ({dLabel(d)})
                        </span>
                      ))}
                      .
                    </>
                  ) : (
                    <>
                      Há <b className="text-white">{alerta.jan}</b> na janela de 7 dias aguardando captação e{' '}
                      <b className="text-white">{alerta.semReg}</b> com regime pendente.
                    </>
                  )}
                </p>
              )}
              <div className="ml-auto flex shrink-0 items-center gap-2">
                {alerta.prej.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterBand('prej')}
                    className="rounded-[9px] px-3 py-1.5 text-[11.5px] font-bold whitespace-nowrap"
                    style={{ background: 'var(--vt-c-prej)', color: '#fff' }}
                  >
                    Ver os {alerta.prej.length} críticos →
                  </button>
                )}
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

        <div className="vt-glass grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-5" style={{ background: 'var(--vt-line)' }}>
          {BANDS.map((b) => {
            const n = contagens[b.k] ?? 0;
            const active = filterBand === b.k;
            return (
              <button
                key={b.k}
                type="button"
                onClick={() => setFilterBand((f) => (f === b.k ? null : b.k))}
                className="relative p-[13px_14px] text-left transition"
                style={{
                  background: active ? '#fff' : 'var(--vt-glass-strong)',
                  boxShadow: active ? `inset 0 -3px 0 var(--vt-c-${b.k})` : undefined,
                }}
              >
                <div className="text-[25px] leading-none font-extrabold tracking-tight" style={{ color: `var(--vt-c-${b.k})` }}>
                  {n}
                </div>
                <div className="mt-1.5 text-[10.5px] font-semibold" style={{ color: 'var(--vt-muted)' }}>
                  {b.l}
                </div>
              </button>
            );
          })}
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
                    ['pr', 'Risco'],
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
                {(
                  [
                    ['dias', 'ETA / Prazo'],
                    ['regime', 'Regime'],
                    ['desp', 'Despachante'],
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
                <TableHead className="text-[11px] font-semibold tracking-[.05em] uppercase" style={{ color: 'var(--vt-muted)' }}>
                  Atracação → Parceiro
                </TableHead>
                <TableHead
                  className="cursor-pointer text-[11px] font-semibold tracking-[.05em] uppercase select-none"
                  style={{ color: sortKey === 'navio' ? 'var(--vt-red)' : 'var(--vt-muted)' }}
                  onClick={() => toggleSort('navio')}
                >
                  Navio{' '}
                  <span style={{ opacity: sortKey === 'navio' ? 1 : 0.35 }}>
                    {sortKey === 'navio' ? (sortDir === 1 ? '▲' : '▼') : '↕'}
                  </span>
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center" style={{ color: 'var(--vt-muted)' }}>
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : linhas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
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
                    <TableCell>
                      <span className={`vt-band b-${b.k}`}>{b.t}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold" style={{ color: 'var(--vt-red)' }} title={r.cli}>
                          {apelidoCliente(r.cli, r.cnpj, clientes)}
                          {r.prov && (
                            <span className="vt-band ml-1" style={{ background: 'var(--vt-bg-jan)', color: 'var(--vt-c-jan)' }}>
                              provável
                            </span>
                          )}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--vt-muted)' }}>
                          {r.ref.replace(r.cli, '').trim() || r.ref}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap" title={formatDataHora(r.createdAt)}>
                      {formatData(r.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {fmtEta(r.eta)} · {dLabel(d)}
                    </TableCell>
                    <TableCell>
                      {r.regime ? (
                        <span
                          className="inline-block rounded-[6px] px-2.5 py-1 text-[11px] font-semibold"
                          style={
                            r.regime === 'AGUARDANDO'
                              ? { background: 'var(--vt-bg-jan)', color: 'var(--vt-c-jan)' }
                              : { background: 'var(--vt-line)', color: 'var(--vt-ink)' }
                          }
                        >
                          {r.regime}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--vt-c-prej)', fontWeight: 600 }}>falta</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {despValido(r.desp) ?? <span style={{ color: 'var(--vt-c-prej)', fontWeight: 600 }}>inválido</span>}
                    </TableCell>
                    <TableCell>
                      {shortTerm(r.atrac) || '—'} <span style={{ color: 'var(--vt-red)', fontWeight: 700 }}>→</span> {shortTerm(r.parc) || '—'}
                    </TableCell>
                    <TableCell>{(r.navio || '').slice(0, 18)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.capId && (
                        // Simplificado a pedido (11/09/2026): só editar/excluir aqui.
                        // Tinha Efetivar/Docs/status ("captado"/"saiu") antes — pode
                        // voltar a esse modelo mais completo depois, ver histórico
                        // da conversa se precisar recuperar. Botões Captar/captado
                        // removidos a pedido (14/09/2026) das linhas sem captação.
                        <RowActions
                          onEdit={() => router.push(`/captacoes?edit=${r.capId}`)}
                          onDelete={() => handleDelete(r.capId!)}
                        />
                      )}
                    </TableCell>
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
