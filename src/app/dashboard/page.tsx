'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import type { Captacao } from '@/lib/types';
import { capDate, noPeriodo, qtd, sumBy, ym, type Periodo } from '@/lib/dashboard';
import { Button } from '@/components/ui/button';

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

function Bars({ entries }: { entries: [string, number][] }) {
  const top = entries.slice(0, 8);
  const mx = Math.max(1, ...top.map(([, n]) => n));
  if (top.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem dados.</p>;
  }
  return (
    <div className="space-y-1.5">
      {top.map(([label, n]) => (
        <div key={label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate" title={label}>
            {label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((n / mx) * 100)}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right font-mono">{n}</span>
        </div>
      ))}
    </div>
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

  const kpis: [string, number][] = [
    [`Captações · ${rotulo}`, selecionadas.length],
    [`Contêineres · ${rotulo}`, contadores],
    [`Clientes · ${rotulo}`, clientesSelecionados],
    ['Total histórico', captacoes.length],
    ['Tabela pública', publica],
  ];

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Captações concluídas · {rotulo} — mesma base do painel de TV · {captacoes.length} no
            histórico total
          </p>
        </div>
        <div className="flex gap-1">
          {PERIODOS.map(({ p, label }) => (
            <Button key={p} size="sm" variant={periodo === p ? 'default' : 'outline'} onClick={() => setPeriodo(p)}>
              {label}
            </Button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpis.map(([label, n]) => (
          <div key={label} className="rounded-lg border p-3">
            <div className="text-2xl font-semibold">{loading ? '—' : n}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Top clientes · contêineres · {rotulo}</h3>
          <Bars entries={porCliente} />
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Por parceiro · contêineres · {rotulo}</h3>
          <Bars entries={porParceiro} />
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Contêineres por mês · últimos 6</h3>
          <Bars entries={meses.map((m) => [m.label, m.n])} />
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Por despachante · contêineres · {rotulo}</h3>
          <Bars entries={porDespachante} />
        </div>
      </div>
    </div>
  );
}
