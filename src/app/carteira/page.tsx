'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { CockpitRow, ImportResult } from '@/lib/types';
import { BANDS, banda, diasAte, dLabel, fmtEta, shortTerm } from '@/lib/risco';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

export default function CarteiraPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CockpitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterBand, setFilterBand] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [ask, setAsk] = useState('');
  const [askAnswer, setAskAnswer] = useState<React.ReactNode>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [alertMin, setAlertMin] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(ALERT_MIN_KEY) === '1';
    } catch {
      return false;
    }
  });

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
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(({ r }) => JSON.stringify(r).toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => a.d - b.d);
  }, [enriquecidas, busca, filterBand]);

  const totalContainers = linhas.reduce((s, { r }) => s + (Number(r.qtd) || 1), 0);

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

  function handleAsk() {
    const raw = ask.trim();
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
          <p className="text-muted-foreground">Nada encontrado.</p>
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
      await load();
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

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Carteira de captação</h1>
          <p className="text-sm text-muted-foreground">
            {linhas.length} processos · {totalContainers} contêineres
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport}>
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
          <Button variant="outline" disabled={importing} onClick={() => fileInputRef.current?.click()}>
            {importing ? 'Lendo a planilha…' : 'Importar Logcomex'}
          </Button>
          <Button onClick={() => router.push('/captacoes')}>+ Nova captação</Button>
        </div>
      </div>

      {importSummary && (
        <div className="rounded-lg border bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          <b>{importSummary.processados}</b> processados · <b>{importSummary.porCnpj}</b> por CNPJ ·{' '}
          <b>{importSummary.provaveis}</b> prováveis · <b>{importSummary.ignorados}</b> ignorados
        </div>
      )}

      <div className="rounded-lg border bg-zinc-900 p-4 text-zinc-50">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-red-300 uppercase">
            Alerta de hoje
          </h2>
          <button
            type="button"
            onClick={toggleAlertMin}
            className="rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
          >
            {alertMin ? '▴' : '▾'}
          </button>
        </div>
        {!alertMin && (
          <p className="text-sm leading-relaxed">
            {alerta.prej.length > 0 && (
              <>
                Hoje <b>{alerta.prej.length} processo(s)</b> exigem ação imediata para não virar
                tabela pública —{' '}
                {alerta.prej.slice(0, 2).map(({ r, d }, i) => (
                  <span key={r.capId ?? r.bl} className="text-red-300">
                    {i > 0 && ' e '}
                    {r.cli} {r.ref.replace(r.cli, '').trim()} ({dLabel(d)})
                  </span>
                ))}
                .{' '}
              </>
            )}
            Há <b>{alerta.jan}</b> na janela de 7 dias aguardando captação e{' '}
            <b>{alerta.semReg}</b> com regime pendente.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {BANDS.map((b) => (
          <button
            key={b.k}
            type="button"
            onClick={() => setFilterBand((f) => (f === b.k ? null : b.k))}
            className={`rounded-lg border p-3 text-left transition-colors ${
              filterBand === b.k ? 'border-primary bg-primary/5' : ''
            }`}
          >
            <div className="text-2xl font-semibold">{contagens[b.k] ?? 0}</div>
            <div className="text-xs text-muted-foreground">{b.l}</div>
          </button>
        ))}
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex gap-2">
          <Input
            placeholder="ex.: o que falta captar da Tecno? — ou cole um container/BL"
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          />
          <Button onClick={handleAsk}>Buscar</Button>
        </div>
        {askAnswer && <div className="mt-3 text-sm">{askAnswer}</div>}
      </div>

      <Input
        placeholder="buscar cliente, container ou BL"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="max-w-sm"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Risco</TableHead>
              <TableHead>Cliente / Ref.</TableHead>
              <TableHead>ETA / Prazo</TableHead>
              <TableHead>Regime</TableHead>
              <TableHead>Despachante</TableHead>
              <TableHead>Atracação → Parceiro</TableHead>
              <TableHead>Navio</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : linhas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Radar vazio.
                </TableCell>
              </TableRow>
            ) : (
              linhas.map(({ r, b, d }) => (
                <TableRow key={r.capId ?? `${r.bl}-${r.ref}`}>
                  <TableCell>
                    <Badge variant="secondary">{b.t}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.cli} <span className="text-muted-foreground">{r.ref.replace(r.cli, '').trim()}</span>
                    {r.prov && (
                      <Badge variant="outline" className="ml-1">
                        provável
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {fmtEta(r.eta)} · {dLabel(d)}
                  </TableCell>
                  <TableCell>{r.regime || <span className="text-destructive">falta</span>}</TableCell>
                  <TableCell>{despValido(r.desp) ?? <span className="text-destructive">inválido</span>}</TableCell>
                  <TableCell>
                    {shortTerm(r.atrac) || '—'} → {shortTerm(r.parc) || '—'}
                  </TableCell>
                  <TableCell>{(r.navio || '').slice(0, 18)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.capId ? (
                      <>
                        {b.k === 'prej' && r.stage === 'MANIFESTADA_DOCS' && (
                          <Button size="sm" onClick={() => efetivar(r.capId!)}>
                            Efetivar
                          </Button>
                        )}
                        {r.stage === 'MANIFESTADA_PARC' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/captacoes?edit=${r.capId}`)}
                          >
                            Docs
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/captacoes?edit=${r.capId}`)}
                        >
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(r.capId!)}>
                          Excluir
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => captar(r)}>
                          Captar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => marcarCaptado(r)}>
                          captado
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
