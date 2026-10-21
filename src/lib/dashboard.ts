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
export function dataRegistro(c: Captacao): Date | null {
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

// ---------------------------------------------------------------------------
// Dashboard redesenhado (21/10/2026). Tudo derivado das captações — nada
// de meta ou número fixo. Período usa dataRegistro() (mesma regra dos KPIs);
// a série de 6 meses continua em capDate() (mesma regra do painel de TV).
// ---------------------------------------------------------------------------

export function noPeriodoAnterior(c: Captacao, p: Periodo, now: Date): boolean {
  if (p === 'total') return false;
  const ref = new Date(now);
  if (p === 'hoje') ref.setDate(ref.getDate() - 1);
  else if (p === 'semana') ref.setDate(ref.getDate() - 7);
  else ref.setMonth(ref.getMonth() - 1, 1);
  return noPeriodo(c, p, ref);
}

export function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

// "No ritmo atual": contêineres até hoje ÷ dias corridos × dias do mês.
export function projecaoMes(conteineresAteHoje: number, now: Date): number {
  const dias = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.round((conteineresAteHoje / now.getDate()) * dias);
}

export function chaveDiaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function melhorDia(list: Captacao[]): { dia: Date; conteineres: number } | null {
  const m = new Map<string, { dia: Date; conteineres: number }>();
  for (const c of list) {
    const d = dataRegistro(c);
    if (!d) continue;
    const k = chaveDiaLocal(d);
    const atual = m.get(k) ?? { dia: new Date(d.getFullYear(), d.getMonth(), d.getDate()), conteineres: 0 };
    atual.conteineres += qtd(c);
    m.set(k, atual);
  }
  let melhor: { dia: Date; conteineres: number } | null = null;
  for (const v of m.values()) if (!melhor || v.conteineres > melhor.conteineres) melhor = v;
  return melhor;
}

export type Mes = { key: string; label: string; conteineres: number; captacoes: number; clientes: number };

export function serieMensal(list: Captacao[], now: Date, n = 6): Mes[] {
  const meses = Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return {
      key: ym(d),
      label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      conteineres: 0,
      captacoes: 0,
      clientes: new Set<string>(),
    };
  });
  for (const c of list) {
    const slot = meses.find((m) => m.key === ym(capDate(c)));
    if (!slot) continue;
    slot.conteineres += qtd(c);
    slot.captacoes += 1;
    if (c.cli) slot.clientes.add(c.cli);
  }
  return meses.map((m) => ({ ...m, clientes: m.clientes.size }));
}

export type Fluxo = { de: string; para: string; conteineres: number };

export function fluxosRotas(list: Captacao[], nomear: (s: string) => string = (s) => s, max = 6): Fluxo[] {
  const m = new Map<string, Fluxo>();
  for (const c of list) {
    if (!c.terminalDescarga || !c.terminalCaptado) continue;
    const de = nomear(c.terminalDescarga);
    const para = nomear(c.terminalCaptado);
    const k = `${de}→${para}`;
    const f = m.get(k) ?? { de, para, conteineres: 0 };
    f.conteineres += qtd(c);
    m.set(k, f);
  }
  return [...m.values()].sort((a, b) => b.conteineres - a.conteineres).slice(0, max);
}

// Mapa de calor: `semanas` colunas (segunda a domingo), terminando na semana
// de `now`. Cada célula conta captações registradas naquele dia.
export function mapaDeCalor(list: Captacao[], now: Date, semanas = 16): { dia: Date; n: number; futuro: boolean }[][] {
  const porDia = new Map<string, number>();
  for (const c of list) {
    const d = dataRegistro(c);
    if (d) porDia.set(chaveDiaLocal(d), (porDia.get(chaveDiaLocal(d)) ?? 0) + 1);
  }
  const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const segundaAtual = new Date(hoje);
  segundaAtual.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
  return Array.from({ length: semanas }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const dia = new Date(segundaAtual);
      dia.setDate(segundaAtual.getDate() - (semanas - 1 - w) * 7 + d);
      return { dia, n: porDia.get(chaveDiaLocal(dia)) ?? 0, futuro: dia > hoje };
    }),
  );
}

// Dias úteis seguidos (seg–sex) com pelo menos uma captação, contando pra
// trás a partir de hoje — se hoje ainda não teve, começa de ontem.
export function sequenciaDiasUteis(list: Captacao[], now: Date): number {
  const dias = new Set<string>();
  for (const c of list) {
    const d = dataRegistro(c);
    if (d) dias.add(chaveDiaLocal(d));
  }
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const util = (x: Date) => x.getDay() !== 0 && x.getDay() !== 6;
  if (!dias.has(chaveDiaLocal(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    if (util(d)) {
      if (!dias.has(chaveDiaLocal(d))) break;
      n++;
    }
    d.setDate(d.getDate() - 1);
  }
  return n;
}
