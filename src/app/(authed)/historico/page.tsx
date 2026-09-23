'use client';

import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { Captacao } from '@/lib/types';
import { shortTerm } from '@/lib/risco';
import { formatData, formatDataHora } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ship-scene';
import { SegmentedControl } from '@/components/segmented-control';
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
type Dia = 'hoje' | 'ontem' | 'anteontem' | 'data' | 'tudo';
type StatusFiltro = 'todos' | 'conc' | 'efet' | 'and';

function inicioDoDia(offsetDias: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDias);
  return d;
}

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

export default function HistoricoPage() {
  const router = useRouter();
  const [captacoes, setCaptacoes] = useState<Captacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dia, setDia] = useState<Dia>('tudo');
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
  const [dataSel, setDataSel] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  // Clicar em qualquer ponto do processo (pedido 23/09/2026, mesmo padrão da
  // Carteira) — leva direto pro passo 6 (Revisão) do formulário, que já
  // mostra tudo (inclusive todos os BLs) e já tem editar-por-seção e
  // excluir. Substitui o drawer de detalhe usado antes.
  function handleRowClick(c: Captacao) {
    router.push(`/captacoes?edit=${c.id}&step=5`);
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

  const alvo = useMemo((): Date | null => {
    if (dia === 'hoje') return inicioDoDia(0);
    if (dia === 'ontem') return inicioDoDia(1);
    if (dia === 'anteontem') return inicioDoDia(2);
    if (dia === 'data' && dataSel) return new Date(`${dataSel}T12:00:00`);
    return null;
  }, [dia, dataSel]);

  const linhas = useMemo(() => {
    let rows = [...captacoes];
    if (alvo) {
      rows = rows.filter((c) => {
        const d = c.createdAt ? new Date(c.createdAt) : null;
        return d && !Number.isNaN(d.getTime()) && d.toDateString() === alvo.toDateString();
      });
    }
    // Por padrão, data de registro mais recente primeiro — inclusive em
    // "Tudo". O original ordenava "Tudo" por ETA (index.html:1551), mas
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
  }, [captacoes, alvo, statusFiltro, busca, sortKey, sortDir]);

  // Volta pra página 1 sempre que o filtro muda o conjunto exibido — senão
  // dá pra ficar numa página que não existe mais (ex.: filtrou e sobrou só
  // 1 página, mas você tava na 4). Ajuste durante o render (não em efeito)
  // pra não gerar uma renderização em cascata — ver
  // https://react.dev/learn/you-might-not-need-an-effect.
  const [filtroAnterior, setFiltroAnterior] = useState({ alvo, statusFiltro, busca, sortKey, sortDir });
  if (
    filtroAnterior.alvo !== alvo ||
    filtroAnterior.statusFiltro !== statusFiltro ||
    filtroAnterior.busca !== busca ||
    filtroAnterior.sortKey !== sortKey ||
    filtroAnterior.sortDir !== sortDir
  ) {
    setFiltroAnterior({ alvo, statusFiltro, busca, sortKey, sortDir });
    setPagina(1);
  }

  const totalPaginas = Math.max(1, Math.ceil(linhas.length / PAGE_SIZE));
  const linhasPagina = useMemo(
    () => linhas.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
    [linhas, pagina],
  );

  const glassInput = 'vt-glass-strong rounded-[11px] border-[var(--vt-line)] text-[13px]';

  return (
    <div className="space-y-5 p-6 sm:p-8" style={{ color: 'var(--vt-ink)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[21px] font-bold tracking-tight">Histórico</h1>
            <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--vt-muted)' }}>
              Registro completo de tudo que já foi captado (todos os períodos)
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="vt-glass-strong rounded-[20px] px-3 py-1.5 text-[12px] font-semibold" style={{ color: 'var(--vt-muted)' }}>
              {linhas.length} captações
            </span>
            <Button
              variant="ghost"
              className="vt-btn-primary rounded-[11px] px-3.5 py-2 text-[12.5px] font-semibold transition hover:-translate-y-px"
              onClick={() => router.push('/captacoes')}
            >
              + Nova captação
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-[13px] font-semibold" style={{ color: 'var(--vt-c-prej)' }}>{error}</p>
        )}

        <div className="vt-glass overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-[14px_18px]" style={{ borderBottom: '1px solid var(--vt-line2)' }}>
            <h3 className="text-[14px] font-bold">Captações</h3>
            <SegmentedControl
              options={[
                { value: 'hoje', label: 'Hoje' },
                { value: 'tudo', label: 'Tudo' },
              ]}
              value={dia === 'data' ? 'tudo' : dia}
              onChange={(v: Dia) => setDia(v)}
            />
            <Input
              type="date"
              title="Escolher um dia"
              className={`w-auto ${glassInput}`}
              value={dataSel}
              onChange={(e) => {
                setDataSel(e.target.value);
                setDia(e.target.value ? 'data' : 'tudo');
              }}
            />
            <select
              className="vt-native-select"
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value as StatusFiltro)}
            >
              <option value="todos">Todos os status</option>
              <option value="efet">Efetivado</option>
              <option value="and">Em andamento</option>
              <option value="conc">Concluído</option>
            </select>
            <Input
              placeholder="buscar cliente, BL, navio…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className={`ml-auto w-[220px] ${glassInput}`}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: 'var(--vt-line)' }}>
                {['Status', 'Cliente / Referência'].map((h) => (
                  <TableHead key={h} className="text-[11px] font-semibold tracking-[.05em] uppercase" style={{ color: 'var(--vt-muted)' }}>
                    {h}
                  </TableHead>
                ))}
                {(
                  [
                    ['registrado', 'Registrado em'],
                    ['eta', 'ETA'],
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
                  Despachante
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-[.05em] uppercase" style={{ color: 'var(--vt-muted)' }}>
                  Atracação → Parceiro
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center" style={{ color: 'var(--vt-muted)' }}>
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : linhas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState title="Histórico vazio" subtitle="As captações aparecem aqui conforme forem feitas." />
                  </TableCell>
                </TableRow>
              ) : (
                linhasPagina.map((c) => (
                  <TableRow
                    key={c.id}
                    tabIndex={0}
                    className="cursor-pointer"
                    style={{ borderColor: 'var(--vt-line)' }}
                    onClick={() => handleRowClick(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(c);
                      }
                    }}
                  >
                    <TableCell>
                      <span className={`vt-band ${c.stage === 'SAIU_TERMINAL' ? 'b-conc' : c.stage === 'EFETIVA' ? 'b-efet' : 'b-and'}`}>
                        {STAGE_LABEL[c.stage ?? ''] ?? 'Em andamento'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[170px] text-[13px]">
                      <div className="flex flex-col gap-px">
                        <span
                          title={c.cli ?? undefined}
                          className="truncate font-bold"
                          style={{ color: 'var(--vt-red)' }}
                        >
                          {c.cli}
                        </span>
                        <span
                          title={c.referencia ?? undefined}
                          className="truncate"
                          style={{ color: 'var(--vt-muted)' }}
                        >
                          {c.referencia}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">
                      {formatDataHora(c.createdAt)}
                    </TableCell>
                    <TableCell className="text-[13px]">{formatData(c.eta)}</TableCell>
                    <TableCell className="text-[13px]">
                      {despValido(c.despachante) ?? <span style={{ color: 'var(--vt-c-prej)', fontWeight: 600 }}>inválido</span>}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {shortTerm(c.terminalDescarga) || '—'} <span style={{ color: 'var(--vt-red)', fontWeight: 700 }}>→</span> {shortTerm(c.terminalCaptado) || '—'}
                    </TableCell>
                    <TableCell className="text-right text-[13px]" style={{ color: 'var(--vt-muted2)' }}>
                      ›
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
  );
}
