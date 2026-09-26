'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import type { Captacao } from '@/lib/types';
import { capDate, noPeriodo, qtd, sumBy, ym, type Periodo } from '@/lib/dashboard';
import { SegmentedControl } from '@/components/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';

// Comportamento portado de captacao-valetrade/public/index.html
// (renderDashboard, setPeriodo, _bars). Ver
// migration-plan/features/dashboard/CURRENT_BEHAVIOR.md e
// migration-plan/prompts/06-dashboard.md — duas regras de data diferentes
// na mesma tela, preservadas exatamente (ver lib/dashboard.ts).
const PERIODOS: { p: Periodo; label: string }[] = [
  { p: 'hoje', label: 'Hoje' },
  { p: 'semana', label: 'Semana' },
  { p: 'mes', label: 'Mês' },
  { p: 'total', label: 'Total' },
];

// Ranking: cor sólida (uma série = uma cor, gradiente não representava
// nada) + rank numerado + valor colado na barra + tooltip nativo no hover.
function Bars({ entries, unidade = 'contêineres' }: { entries: [string, number][]; unidade?: string }) {
  const top = entries.slice(0, 8);
  const mx = Math.max(1, ...top.map(([, n]) => n));
  if (top.length === 0) {
    return <p className="text-xs" style={{ color: 'var(--vt-muted)' }}>Sem dados.</p>;
  }
  return (
    <div className="space-y-2">
      {top.map(([label, n], i) => (
        <div key={label} className="flex items-center gap-2 text-xs" title={`${label} — ${n} ${unidade}`}>
          <span className="w-3.5 shrink-0 text-right font-mono font-bold" style={{ color: 'var(--vt-muted2)' }}>
            {i + 1}
          </span>
          <span className="w-[110px] shrink-0 truncate font-semibold">{label}</span>
          <div className="h-[16px] flex-1 overflow-hidden rounded-[5px]" style={{ background: 'var(--vt-line2)' }}>
            <div
              className="h-full min-w-[2px] rounded-[5px] transition-[filter] hover:brightness-110"
              style={{ width: `${Math.round((n / mx) * 100)}%`, background: 'var(--vt-red)' }}
            />
          </div>
          <span className="w-6 shrink-0 text-right font-mono font-bold">{n}</span>
        </div>
      ))}
    </div>
  );
}

// Série temporal: linha/área, não barra de ranking — o formato de barra
// escondia a tendência (mês mais alto aparecia sempre em cima, fora de
// ordem cronológica). Mês atual (último ponto) ganha destaque.
export function TrendChart({ points }: { points: { label: string; n: number }[] }) {
  // Passar o mouse numa bolinha mostra o total daquele mês — antes só o
  // último mês tinha o número visível; os outros dependiam do tooltip
  // nativo do navegador (<title>), que é lento e pouco visível. Pedido em
  // 16/09/2026.
  const [hover, setHover] = useState<number | null>(null);
  const w = 340;
  const h = 150;
  const padL = 30;
  const padR = 10;
  const padT = 16;
  const padB = 24;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const mx = Math.max(1, ...points.map((p) => p.n));
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    ...p,
    x: padL + step * i,
    y: padT + innerH - (p.n / mx) * innerH,
  }));
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `M${coords[0]?.x ?? padL},${padT + innerH} L${line
    .split(' ')
    .join(' L')} L${coords[coords.length - 1]?.x ?? padL},${padT + innerH} Z`;
  const gridY = [0, 0.5, 1].map((f) => padT + innerH * f);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="dashTrendFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--vt-red)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--vt-red)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridY.map((y) => (
        <line key={y} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--vt-line2)" strokeWidth={1} />
      ))}
      <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="var(--vt-line)" strokeWidth={1} />
      <path d={area} fill="url(#dashTrendFade)" />
      <polyline points={line} fill="none" stroke="var(--vt-red)" strokeWidth={2} />
      {coords.map((c, i) => {
        const isLast = i === coords.length - 1;
        const showLabel = isLast || hover === i;
        return (
          <g
            key={c.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            style={{ cursor: 'pointer' }}
          >
            {/* área invisível maior — só a bolinha visível (r=3.5) é pequena
                demais pra passar o mouse com precisão */}
            <circle cx={c.x} cy={c.y} r={10} fill="transparent" />
            <circle
              cx={c.x}
              cy={c.y}
              r={isLast || hover === i ? 5 : 3.5}
              fill={isLast || hover === i ? 'var(--vt-red)' : '#fff'}
              stroke="var(--vt-red)"
              strokeWidth={2}
            >
              <title>{`${c.label} — ${c.n} contêineres`}</title>
            </circle>
            {showLabel && (
              <text x={c.x} y={c.y - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--vt-ink)">
                {c.n}
              </text>
            )}
            <text x={c.x} y={h - 4} textAnchor="middle" fontSize="10" fill="var(--vt-muted)">
              {c.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function DashboardPage() {
  const [captacoes, setCaptacoes] = useState<Captacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>('mes');

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Captacao[]>('/captacoes');
      setCaptacoes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const now = useMemo(() => new Date(), []);
  const nomeMes = now.toLocaleDateString('pt-BR', { month: 'long' });
  const rotulo = { hoje: 'hoje', semana: 'esta semana', mes: nomeMes, total: 'todo o período' }[periodo];

  // KPIs 1-3 e rankings: sobre o período selecionado.
  const selecionadas = useMemo(
    () => captacoes.filter((c) => noPeriodo(c, periodo, now)),
    [captacoes, periodo, now],
  );
  const contadores = useMemo(
    () => selecionadas.reduce((s, c) => s + qtd(c), 0),
    [selecionadas],
  );
  const clientesSelecionados = useMemo(
    () => new Set(selecionadas.map((c) => c.cli).filter(Boolean)).size,
    [selecionadas],
  );
  // KPIs 4-5: SEMPRE sobre todo o histórico, sem aplicar o filtro de período.
  const publica = useMemo(() => captacoes.filter((c) => c.prejuizoPublico).length, [captacoes]);

  const porCliente = useMemo(() => sumBy(selecionadas, (c) => c.cli), [selecionadas]);
  const porParceiro = useMemo(() => sumBy(selecionadas, (c) => c.terminalCaptado), [selecionadas]);
  const porDespachante = useMemo(() => sumBy(selecionadas, (c) => c.despachante), [selecionadas]);

  // Evolução de 6 meses: SEMPRE sobre todo o histórico, por capDate() —
  // regra de data diferente da usada acima, de propósito.
  const meses = useMemo(() => {
    const lista = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: ym(d), label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), n: 0 };
    });
    for (const c of captacoes) {
      const k = ym(capDate(c));
      const slot = lista.find((m) => m.key === k);
      if (slot) slot.n += qtd(c);
    }
    return lista;
  }, [captacoes, now]);

  // Mesmas 5 cores de banda do original (renderDashboard: and/efet/jan/conc/prej) —
  // não são as bandas de risco de verdade aqui, só reaproveitam a paleta.
  const kpis: [string, number, string, boolean?][] = [
    [`Captações · ${rotulo}`, selecionadas.length, 'and'],
    [`Contêineres · ${rotulo}`, contadores, 'efet'],
    [`Clientes · ${rotulo}`, clientesSelecionados, 'jan'],
    ['Total histórico', captacoes.length, 'conc', true],
    ['Tabela pública', publica, 'prej', true],
  ];

  return (
    <div className="space-y-5 p-6 sm:p-8" style={{ color: 'var(--vt-ink)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[21px] font-bold tracking-tight">Dashboard</h1>
            <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--vt-muted)' }}>
              Captações concluídas · {rotulo} — mesma base do painel de TV · {captacoes.length} no
              histórico total
            </p>
          </div>
          <SegmentedControl
            options={PERIODOS.map(({ p, label }) => ({ value: p, label }))}
            value={periodo}
            onChange={(v: Periodo) => setPeriodo(v)}
          />
        </div>

        {error && (
          <p className="text-[13px] font-semibold" style={{ color: 'var(--vt-c-prej)' }}>{error}</p>
        )}

        <div className="vt-glass grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-5" style={{ background: 'var(--vt-line)' }}>
          {kpis.map(([label, n, band, total]) => (
            <div key={label} className="relative p-[13px_14px] text-left" style={{ background: 'var(--vt-glass-strong)' }}>
              {total && (
                <span className="absolute top-[9px] right-2.5 text-[8.5px] font-extrabold tracking-wide uppercase" style={{ color: 'var(--vt-muted2)' }}>
                  total
                </span>
              )}
              <div className="text-[25px] leading-none font-extrabold tracking-tight" style={{ color: `var(--vt-c-${band})` }}>
                {loading ? <Skeleton className="h-[25px] w-9" /> : n}
              </div>
              <div className="mt-1.5 text-[10.5px] font-semibold" style={{ color: 'var(--vt-muted)' }}>{label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="vt-glass p-[18px_20px]">
            <h3 className="mb-3 text-[13px] font-bold">Top clientes · contêineres · {rotulo}</h3>
            <Bars entries={porCliente} />
          </div>
          <div className="vt-glass p-[18px_20px]">
            <h3 className="mb-3 text-[13px] font-bold">Por parceiro · contêineres · {rotulo}</h3>
            <Bars entries={porParceiro} />
          </div>
          <div className="vt-glass p-[18px_20px]">
            <h3 className="mb-3 text-[13px] font-bold">Contêineres por mês · últimos 6</h3>
            <TrendChart points={meses.map((m) => ({ label: m.label, n: m.n }))} />
          </div>
          <div className="vt-glass p-[18px_20px]">
            <h3 className="mb-3 text-[13px] font-bold">Por despachante · contêineres · {rotulo}</h3>
            <Bars entries={porDespachante} />
          </div>
        </div>
      </div>
  );
}
