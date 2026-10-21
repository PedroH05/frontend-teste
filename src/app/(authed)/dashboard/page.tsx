'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, History as HistoryIcon, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch, ApiError } from '@/lib/api';
import type { Captacao } from '@/lib/types';
import { shortTerm } from '@/lib/risco';
import {
  fluxosRotas,
  mapaDeCalor,
  melhorDia,
  noPeriodo,
  noPeriodoAnterior,
  projecaoMes,
  qtd,
  sequenciaDiasUteis,
  serieMensal,
  sumBy,
  variacaoPct,
  type Fluxo,
  type Periodo,
} from '@/lib/dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Comportamento portado de captacao-valetrade/public/index.html
// (renderDashboard, setPeriodo, _bars). Ver
// migration-plan/features/dashboard/CURRENT_BEHAVIOR.md e
// migration-plan/prompts/06-dashboard.md — duas regras de data diferentes
// na mesma tela, preservadas exatamente (ver lib/dashboard.ts).
//
// Visual redesenhado em 21/10/2026 (pedido: "use criatividade, dê mais
// vida"), aprovado no artefato "Dashboard Valetrade". Tudo que é novo
// (comparação, projeção, rotas, mapa de calor, sequência) é conta em cima
// das mesmas captações — nada de meta ou número fixo.
const PERIODOS: { p: Periodo; label: string }[] = [
  { p: 'hoje', label: 'Hoje' },
  { p: 'semana', label: 'Semana' },
  { p: 'mes', label: 'Mês' },
  { p: 'total', label: 'Total' },
];

const ANTERIOR: Record<Periodo, string> = { hoje: 'ontem', semana: 'semana passada', mes: '', total: '' };

function semMovimentoReduzido(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Número que conta de 0 até o valor ao aparecer. Sem matchMedia (testes) ou
// com movimento reduzido, mostra o valor direto.
function CountUp({ value, className }: { value: number; className?: string }) {
  const [animado, setAnimado] = useState<number | null>(null);
  useEffect(() => {
    if (!semMovimentoReduzido() || typeof requestAnimationFrame !== 'function') return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 1100);
      setAnimado(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
      else setAnimado(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={cn('tabular-nums', className)}>{animado ?? value}</span>;
}

function Sparkline({ valores }: { valores: number[] }) {
  const W = 96;
  const H = 34;
  const mx = Math.max(...valores);
  const mn = Math.min(...valores);
  const pts = valores.map((n, i) => [3 + (i * (W - 6)) / Math.max(1, valores.length - 1), H - 4 - ((n - mn) / (mx - mn || 1)) * (H - 10)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  const ultimo = pts[pts.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="vtSpark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${ultimo[0]},${H} L${pts[0][0]},${H}Z`} fill="url(#vtSpark)" />
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={ultimo[0]} cy={ultimo[1]} r={3} fill="var(--primary)" />
    </svg>
  );
}

// Gráfico de área dos 6 meses (fundo escuro do destaque). Passar o mouse
// numa coluna mostra o total do mês e a variação contra o anterior —
// antes só o último mês tinha número visível (pedido 16/09/2026).
export function TrendChart({ points }: { points: { label: string; n: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 250;
  const pl = 34;
  const pr = 16;
  const pt = 30;
  const pb = 30;
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const mx = Math.max(10, Math.ceil(Math.max(...points.map((p) => p.n)) / 10) * 10);
  const step = points.length > 1 ? iw / (points.length - 1) : 0;
  const c = points.map((p, i) => ({ ...p, x: pl + step * i, y: pt + ih - (p.n / mx) * ih }));
  const curva = c
    .map((p, i) => {
      if (!i) return `M${p.x},${p.y}`;
      const q = c[i - 1];
      const cx = (q.x + p.x) / 2;
      return `C${cx},${q.y} ${cx},${p.y} ${p.x},${p.y}`;
    })
    .join(' ');
  const ultimo = c.length - 1;
  const h = hover !== null ? c[hover] : null;
  const anterior = hover !== null && hover > 0 ? c[hover - 1] : null;
  const delta = h && anterior ? variacaoPct(h.n, anterior.n) : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label="Contêineres por mês">
        <defs>
          <linearGradient id="vtTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8364F" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#C8102E" stopOpacity="0" />
          </linearGradient>
          <filter id="vtTrendGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={pt + ih * t} y2={pt + ih * t} stroke="rgba(255,255,255,.08)" />
            <text x={pl - 8} y={pt + ih * t + 4} textAnchor="end" fontSize={10} fill="#71717A">
              {Math.round(mx * (1 - t))}
            </text>
          </g>
        ))}
        {c.length > 0 && (
          <>
            <path d={`${curva} L${c[ultimo].x},${pt + ih} L${pl},${pt + ih}Z`} fill="url(#vtTrendFill)" />
            <path
              d={curva}
              pathLength={1}
              className="vt-dash-draw"
              fill="none"
              stroke="#FF5A70"
              strokeWidth={3}
              strokeLinecap="round"
              filter="url(#vtTrendGlow)"
            />
          </>
        )}
        {c.map((p, i) => {
          const destaque = i === ultimo || hover === i;
          return (
            <g key={p.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover((v) => (v === i ? null : v))}>
              {i === ultimo && <circle cx={p.x} cy={p.y} r={14} fill="#FF5A70" opacity={0.18} />}
              <rect x={p.x - step / 2} y={pt} width={Math.max(step, 20)} height={ih} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={destaque ? 6 : 4}
                fill={destaque ? '#fff' : 'var(--sidebar)'}
                stroke="#FF5A70"
                strokeWidth={2.5}
              />
              {i === ultimo && hover === null && (
                <text x={p.x} y={p.y - 18} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">
                  {p.n}
                </text>
              )}
              <text
                x={p.x}
                y={H - 8}
                textAnchor="middle"
                fontSize={11}
                fontWeight={i === ultimo ? 600 : 400}
                fill={i === ultimo ? '#fff' : '#71717A'}
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      {h && (
        <div
          role="tooltip"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[115%] rounded-lg bg-white px-2.5 py-2 text-xs whitespace-nowrap text-foreground shadow-xl"
          style={{ left: `${(h.x / W) * 100}%`, top: `${(h.y / H) * 100}%` }}
        >
          <span className="text-muted-foreground">{h.label}</span>
          <b className="block text-[15px] font-semibold">{h.n} contêineres</b>
          {delta !== null && anterior && (
            <span className={delta >= 0 ? 'text-success' : 'text-primary'}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs {anterior.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const CORES_SERIE = ['#C8102E', '#E3485F', '#F49AA8', '#B45309', '#63636B', '#A1A1AA'];

function Rotas({ fluxos }: { fluxos: Fluxo[] }) {
  if (fluxos.length === 0) {
    return <p className="mt-6 text-sm text-muted-foreground">Sem rotas com atracação e parceiro no período.</p>;
  }
  const H = 250;
  const gap = 14;
  const origens = [...new Set(fluxos.map((f) => f.de))];
  const destinos = [...new Set(fluxos.map((f) => f.para))];
  const total = fluxos.reduce((a, f) => a + f.conteineres, 0);
  const escala = (H - 30 - gap * (Math.max(origens.length, destinos.length) - 1)) / total;
  const posicionar = (nomes: string[], lado: 'de' | 'para') => {
    let y = 15;
    const out: Record<string, { y: number; h: number; cur: number; v: number }> = {};
    for (const n of nomes) {
      const v = fluxos.filter((f) => f[lado] === n).reduce((a, f) => a + f.conteineres, 0);
      out[n] = { y, h: v * escala, cur: y, v };
      y += v * escala + gap;
    }
    return out;
  };
  const esq = posicionar(origens, 'de');
  const dir = posicionar(destinos, 'para');
  const x0 = 130;
  const x1 = 390;
  const meio = (x0 + x1) / 2;
  const faixas = fluxos.map((f) => {
    const a = esq[f.de];
    const b = dir[f.para];
    const h = f.conteineres * escala;
    const y0 = a.cur;
    const y1 = b.cur;
    a.cur += h;
    b.cur += h;
    return { f, d: `M${x0},${y0} C${meio},${y0} ${meio},${y1} ${x1},${y1} L${x1},${y1 + h} C${meio},${y1 + h} ${meio},${y0 + h} ${x0},${y0 + h}Z` };
  });
  const rotulos = (lado: typeof esq, x: number, ancora: 'start' | 'end') =>
    Object.entries(lado).map(([n, v]) => (
      <g key={`${ancora}-${n}`}>
        <rect x={ancora === 'end' ? x - 6 : x} y={v.y} width={6} height={Math.max(v.h, 2)} rx={2} fill="var(--foreground)" />
        <text x={x + (ancora === 'end' ? -12 : 12)} y={v.y + v.h / 2 + 2} textAnchor={ancora} fontSize={12} fontWeight={600} fill="var(--foreground)">
          {n}
        </text>
        <text x={x + (ancora === 'end' ? -12 : 12)} y={v.y + v.h / 2 + 16} textAnchor={ancora} fontSize={10.5} fill="var(--muted-foreground)">
          {v.v} cntr
        </text>
      </g>
    ));
  return (
    <svg viewBox="0 0 520 250" className="vt-dash-rotas mt-3 w-full overflow-visible" role="img" aria-label="Rotas atracação para parceiro">
      {faixas.map(({ f, d }) => (
        <path
          key={`${f.de}-${f.para}`}
          d={d}
          className="vt-dash-fluxo transition-opacity"
          fill={CORES_SERIE[destinos.indexOf(f.para) % CORES_SERIE.length]}
          opacity={0.55}
        >
          <title>{`${f.de} → ${f.para}: ${f.conteineres} contêineres`}</title>
        </path>
      ))}
      {rotulos(esq, x0, 'end')}
      {rotulos(dir, x1, 'start')}
    </svg>
  );
}

function Rosca({ entries }: { entries: [string, number][] }) {
  const top = entries.slice(0, 4);
  const resto = entries.slice(4).reduce((a, [, n]) => a + n, 0);
  const dados = resto > 0 ? [...top, ['Outros', resto] as [string, number]] : top;
  const total = dados.reduce((a, [, n]) => a + n, 0);
  if (total === 0) return <p className="mt-6 text-sm text-muted-foreground">Sem dados.</p>;
  const r = 70;
  const circ = 2 * Math.PI * r;
  const comprimentos = dados.map(([, v]) => (v / total) * circ);
  const inicios = comprimentos.map((_, i) => comprimentos.slice(0, i).reduce((a, n) => a + n, 0));
  return (
    <div className="mt-4 flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 180 180" width={170} height={170} role="img" aria-label="Participação por parceiro">
        <circle cx={90} cy={90} r={r} fill="none" stroke="var(--muted)" strokeWidth={20} />
        {dados.map(([n], i) => (
          <circle
            key={n}
            cx={90}
            cy={90}
            r={r}
            fill="none"
            stroke={CORES_SERIE[i % CORES_SERIE.length]}
            strokeWidth={20}
            strokeDasharray={`${Math.max(comprimentos[i] - 2, 0.5)} ${circ}`}
            strokeDashoffset={-inicios[i]}
            transform="rotate(-90 90 90)"
            className="vt-dash-donut"
            style={{ animationDelay: `${0.2 + i * 0.15}s` }}
          />
        ))}
        <text x={90} y={88} textAnchor="middle" fontSize={26} fontWeight={600} fill="var(--foreground)">
          {total}
        </text>
        <text x={90} y={108} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
          contêineres
        </text>
      </svg>
      <ul className="flex min-w-[160px] flex-1 flex-col gap-3">
        {dados.map(([n, v], i) => (
          <li key={n} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: CORES_SERIE[i % CORES_SERIE.length] }} />
            <span className="flex-1 truncate font-medium">{n}</span>
            <span className="font-semibold tabular-nums">{v}</span>
            <span className="w-10 text-right text-muted-foreground tabular-nums">{Math.round((v / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const NIVEIS_CALOR = ['bg-muted', 'bg-[#FBD5DB]', 'bg-[#F49AA8]', 'bg-[#E3485F]', 'bg-primary'];

function MapaCalor({ semanas }: { semanas: { dia: Date; n: number; futuro: boolean }[][] }) {
  const max = Math.max(1, ...semanas.flat().map((c) => c.n));
  const nivel = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  return (
    <div className="mt-4 grid grid-cols-[26px_1fr] gap-1.5">
      <div className="grid grid-rows-7 gap-1 text-[10px] text-muted-foreground">
        {['seg', '', 'qua', '', 'sex', '', ''].map((d, i) => (
          <span key={i} className="flex items-center">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-flow-col grid-rows-7 gap-1" role="img" aria-label="Captações por dia nas últimas semanas">
        {semanas.flat().map(({ dia, n, futuro }) => (
          <span
            key={dia.toISOString()}
            title={futuro ? undefined : `${dia.toLocaleDateString('pt-BR')} — ${n} ${n === 1 ? 'captação' : 'captações'}`}
            className={cn('aspect-square w-full rounded-[4px]', futuro ? 'bg-transparent' : NIVEIS_CALOR[nivel(n)])}
          />
        ))}
      </div>
    </div>
  );
}

const MEDALHAS = ['#D4A017', '#9CA3AF', '#B87333'];

function Ranking({ entries, max = 8 }: { entries: [string, number][]; max?: number }) {
  const top = entries.slice(0, max);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const maior = Math.max(1, ...top.map(([, n]) => n));
  if (top.length === 0) return <p className="mt-4 text-sm text-muted-foreground">Sem dados.</p>;
  return (
    <ol className="mt-4 flex flex-col gap-2.5">
      {top.map(([label, n], i) => (
        <li
          key={label}
          className="grid grid-cols-[26px_32px_minmax(0,1fr)_44px_40px] items-center gap-2.5 text-[13px]"
          title={`${label} — ${n} contêineres`}
        >
          {i < 3 ? (
            <span
              className="flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: MEDALHAS[i] }}
            >
              {i + 1}
            </span>
          ) : (
            <span className="text-center font-semibold text-muted-foreground/70">{i + 1}</span>
          )}
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-[11px] font-semibold text-foreground/80">
            {label.slice(0, 2)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{label}</span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className="vt-dash-grow block h-full rounded-full bg-gradient-to-r from-primary to-[#E8364F]"
                style={{ width: `${(n / maior) * 100}%`, animationDelay: `${0.3 + i * 0.07}s` }}
              />
            </span>
          </span>
          <span className="text-right font-semibold tabular-nums">{n}</span>
          <span className="text-right text-xs text-muted-foreground tabular-nums">
            {total ? Math.round((n / total) * 100) : 0}%
          </span>
        </li>
      ))}
    </ol>
  );
}

function Kpi({
  label,
  badge,
  value,
  loading,
  delay,
  children,
}: {
  label: string;
  badge: string;
  value: number;
  loading: boolean;
  delay: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="vt-dash-up flex flex-col gap-2.5 rounded-xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground/80">{badge}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        {loading ? (
          <Skeleton className="h-[34px] w-16" />
        ) : (
          <span data-slot="kpi-valor" className="text-[34px] leading-none font-semibold tracking-[-0.02em]">
            <CountUp value={value} />
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

function Secao({
  titulo,
  sub,
  delay,
  acao,
  children,
  className,
}: {
  titulo: string;
  sub: string;
  delay: number;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={titulo}
      className={cn('vt-dash-up min-w-0 rounded-xl border bg-card p-5 shadow-sm sm:px-6', className)}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold">{titulo}</h2>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
        {acao}
      </div>
      {children}
    </section>
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
  const nomeMesCap = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
  const rotulo = { hoje: 'hoje', semana: 'esta semana', mes: nomeMes, total: 'todo o período' }[periodo];
  const badge = { hoje: 'Hoje', semana: 'Semana', mes: nomeMesCap, total: 'Total' }[periodo];

  // KPIs, destaque e rankings: sobre o período selecionado.
  const selecionadas = useMemo(() => captacoes.filter((c) => noPeriodo(c, periodo, now)), [captacoes, periodo, now]);
  const contadores = useMemo(() => selecionadas.reduce((s, c) => s + qtd(c), 0), [selecionadas]);
  const clientesSelecionados = useMemo(
    () => new Set(selecionadas.map((c) => c.cli).filter(Boolean)).size,
    [selecionadas],
  );
  const anteriores = useMemo(
    () => captacoes.filter((c) => noPeriodoAnterior(c, periodo, now)).reduce((s, c) => s + qtd(c), 0),
    [captacoes, periodo, now],
  );
  // Total histórico e Tabela pública: SEMPRE sobre todo o histórico.
  const publica = useMemo(() => captacoes.filter((c) => c.prejuizoPublico).length, [captacoes]);

  const porCliente = useMemo(() => sumBy(selecionadas, (c) => c.cli), [selecionadas]);
  const porParceiro = useMemo(() => sumBy(selecionadas, (c) => c.terminalCaptado), [selecionadas]);
  const porDespachante = useMemo(() => sumBy(selecionadas, (c) => c.despachante), [selecionadas]);
  const rotas = useMemo(() => fluxosRotas(selecionadas, (s) => shortTerm(s) || s), [selecionadas]);
  const melhor = useMemo(() => melhorDia(selecionadas), [selecionadas]);

  // Evolução de 6 meses: SEMPRE sobre todo o histórico, por capDate().
  const meses = useMemo(() => serieMensal(captacoes, now), [captacoes, now]);
  const calor = useMemo(() => mapaDeCalor(captacoes, now), [captacoes, now]);
  const sequencia = useMemo(() => sequenciaDiasUteis(captacoes, now), [captacoes, now]);

  const delta = periodo === 'total' ? null : variacaoPct(contadores, anteriores);
  const nomeAnterior =
    periodo === 'mes'
      ? new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
      : ANTERIOR[periodo];

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 p-6 sm:p-8 lg:px-10">
      <header className="vt-dash-up flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>Gestão</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Captações concluídas · {rotulo} — mesma base do painel de TV · {captacoes.length} no histórico total
          </p>
        </div>
        <div role="tablist" aria-label="Período" className="inline-flex gap-0.5 rounded-lg bg-muted p-[3px]">
          {PERIODOS.map(({ p, label }) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={periodo === p}
              onClick={() => setPeriodo(p)}
              className={cn(
                'h-[34px] rounded-md px-3.5 text-[13px] transition',
                periodo === p ? 'bg-card font-semibold shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <section
        aria-label="Destaque do período"
        className="vt-dash-hero vt-dash-up relative grid gap-6 overflow-hidden rounded-[18px] p-6 text-white shadow-[0_20px_40px_-20px_rgba(18,19,24,.5)] sm:p-7 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]"
        style={{ animationDelay: '0.05s' }}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-zinc-400 uppercase">
            <span className="vt-dash-live size-2 rounded-full bg-[#22C55E]" />
            {badge} · ao vivo
          </div>
          <div className="vt-dash-heronum mt-3.5 mb-1.5 text-[76px] leading-none font-semibold tracking-[-0.04em]">
            {loading ? <Skeleton className="h-[76px] w-40 bg-white/10" /> : <CountUp value={contadores} />}
          </div>
          <div className="text-[15px] text-zinc-300">contêineres captados · {rotulo}</div>
          {delta !== null && !loading && (
            <div
              className={cn(
                'mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold',
                delta >= 0 ? 'bg-[#22C55E]/15 text-[#86EFAC]' : 'bg-primary/25 text-[#FFB3BE]',
              )}
            >
              {delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {delta >= 0 ? '+' : ''}
              {delta}% vs {nomeAnterior}
              <span className="font-medium text-zinc-400">({anteriores})</span>
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {periodo === 'mes' && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
                <div className="text-[11.5px] text-zinc-400">No ritmo atual</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">~{projecaoMes(contadores, now)}</div>
                <div className="mt-0.5 text-[11.5px] text-zinc-500">
                  projeção até {new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </div>
              </div>
            )}
            {melhor && periodo !== 'hoje' && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
                <div className="text-[11.5px] text-zinc-400">Melhor dia</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{melhor.conteineres}</div>
                <div className="mt-0.5 text-[11.5px] text-zinc-500">
                  {melhor.dia.toLocaleDateString('pt-BR', { weekday: 'long' })},{' '}
                  {melhor.dia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="relative z-10 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Contêineres por mês</h2>
            <span className="text-xs text-zinc-500">últimos 6 meses · passe o mouse</span>
          </div>
          <TrendChart points={meses.map((m) => ({ label: m.label, n: m.conteineres }))} />
        </div>
      </section>

      <section aria-label="Indicadores" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Kpi label="Captações" badge={badge} value={selecionadas.length} loading={loading} delay={0.1}>
          <Sparkline valores={meses.map((m) => m.captacoes)} />
        </Kpi>
        <Kpi label="Clientes atendidos" badge={badge} value={clientesSelecionados} loading={loading} delay={0.15}>
          <Sparkline valores={meses.map((m) => m.clientes)} />
        </Kpi>
        <Kpi label="Total histórico" badge="Total" value={captacoes.length} loading={loading} delay={0.2}>
          <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-muted text-foreground/80">
            <HistoryIcon className="size-4" aria-hidden="true" />
          </span>
        </Kpi>
        <Kpi label="Tabela pública" badge="Total" value={publica} loading={loading} delay={0.25}>
          <span
            className={cn(
              'flex size-[34px] items-center justify-center rounded-[10px]',
              publica === 0 ? 'bg-success-soft text-success' : 'bg-accent text-primary',
            )}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
          </span>
        </Kpi>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Secao titulo="Rotas do período" sub={`Atracação → parceiro captado · espessura = contêineres · ${rotulo}`} delay={0.3}>
          <Rotas fluxos={rotas} />
        </Secao>
        <Secao titulo="Por parceiro" sub={`Participação em contêineres · ${rotulo}`} delay={0.35}>
          <Rosca entries={porParceiro} />
        </Secao>
        <Secao
          titulo="Ritmo diário"
          sub="Captações por dia de registro · últimas 16 semanas"
          delay={0.4}
          acao={
            <span className="text-xs text-muted-foreground">
              Sequência atual:{' '}
              <b className="text-foreground">
                {sequencia} {sequencia === 1 ? 'dia útil' : 'dias úteis'}
              </b>
              {sequencia >= 5 && ' 🔥'}
            </span>
          }
        >
          <MapaCalor semanas={calor} />
          <div className="mt-2.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
            menos
            {NIVEIS_CALOR.map((c) => (
              <span key={c} className={cn('size-[11px] rounded-[3px]', c)} />
            ))}
            mais
          </div>
        </Secao>
        <Secao
          titulo="Top clientes"
          sub={`Contêineres · ${rotulo}`}
          delay={0.45}
          acao={
            <Link href="/clientes" className="text-[13px] font-medium text-primary hover:underline">
              Ver todos
            </Link>
          }
        >
          <Ranking entries={porCliente} />
        </Secao>
        <Secao titulo="Por despachante" sub={`Contêineres · ${rotulo}`} delay={0.5} className="lg:col-span-2">
          <div className="max-w-[720px]">
            <Ranking entries={porDespachante} />
          </div>
        </Secao>
      </div>
    </div>
  );
}
