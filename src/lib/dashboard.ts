// Portado de captacao-valetrade/public/index.html (_noPeriodo, _capDate,
// _qtd, _ym, _bars). Ver migration-plan/features/dashboard/CURRENT_BEHAVIOR.md
// — DUAS regras de data diferentes na mesma tela, preservadas exatamente.
import type { Captacao } from './types';

export type Periodo = 'hoje' | 'semana' | 'mes' | 'total';

function inicioSemana(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // segunda = 0
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Data em que a captação foi FEITA (registro), não a ETA — usada pelo
// filtro rápido Hoje/Semana/Mês/Total e pelos KPIs/rankings do período.
function dataRegistro(c: Captacao): Date | null {
  const d = c.createdAt ? new Date(c.createdAt) : capDate(c);
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

export function noPeriodo(c: Captacao, p: Periodo, now: Date): boolean {
  const d = dataRegistro(c);
  if (!d) return false;
  if (p === 'total') return true;
  if (p === 'hoje') return d.toDateString() === now.toDateString();
  if (p === 'semana') {
    const ini = inicioSemana(now);
    const fim = new Date(ini);
    fim.setDate(ini.getDate() + 7);
    return d >= ini && d < fim;
  }
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// Mesma regra de data do painel de TV: date_label (legado, DD/MM/AAAA) →
// eta → created_at. Usada SÓ pelo gráfico de evolução de 6 meses — regra
// diferente da de dataRegistro() acima, de propósito (ver CURRENT_BEHAVIOR.md).
export function capDate(c: Captacao): Date | null {
  const dl = (c.dateLabel ?? '').trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dl)) {
    const [dd, mm, yy] = dl.split('/');
    return new Date(Number(yy), Number(mm) - 1, Number(dd));
  }
  if (c.eta) {
    const d = new Date(`${c.eta.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return c.createdAt ? new Date(c.createdAt) : null;
}

export const qtd = (c: Captacao): number => Number(c.quantidade) || 1;

export const ym = (d: Date | null): string =>
  d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';

export function sumBy(list: Captacao[], keyFn: (c: Captacao) => string | null): [string, number][] {
  const m: Record<string, number> = {};
  for (const c of list) {
    const k = keyFn(c);
    if (k) m[k] = (m[k] ?? 0) + qtd(c);
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
