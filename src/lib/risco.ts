// Classificação visual de risco sobre um CockpitRow — portado de
// captacao-valetrade/public/index.html (banda(), diasAte(), fmtEta(),
// dLabel()). O `stage` já vem calculado do backend (domain/cockpit.ts);
// isso aqui só decide COMO mostrar, não recalcula a regra de negócio.
import type { CockpitRow } from './types';

export interface Banda {
  k: 'prej' | 'jan' | 'and' | 'efet' | 'conc' | 'prog';
  t: string;
  cls: string;
  pr: number;
}

export const BANDS: { k: Banda['k']; l: string }[] = [
  { k: 'prej', l: 'Crítico' },
  { k: 'jan', l: 'Janela aberta ≤7d' },
  { k: 'and', l: 'Em andamento' },
  { k: 'efet', l: 'Efetivado' },
  { k: 'conc', l: 'Concluído' },
];

const hoje = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
};

export function diasAte(eta: string): number {
  if (!eta) return Number.POSITIVE_INFINITY;
  return Math.round((new Date(`${eta.slice(0, 10)}T12:00:00`).getTime() - hoje().getTime()) / 86400000);
}

export function banda(r: CockpitRow): Banda {
  const d = diasAte(r.eta);
  if (r.stage === 'SAIU') return { k: 'conc', t: 'CONCLUÍDO', cls: 'conc', pr: 5 };
  if (r.stage === 'EFETIVA') return { k: 'efet', t: 'EFETIVADO', cls: 'efet', pr: 4 };
  if (r.stage === 'MANIFESTADA_DOCS') return { k: 'prej', t: 'CRÍTICO', cls: 'prej', pr: 1 };
  if (r.stage === 'MANIFESTADA_PARC') return { k: 'and', t: 'EM ANDAMENTO', cls: 'and', pr: 3 };
  if (d <= 2) return { k: 'prej', t: 'CRÍTICO', cls: 'prej', pr: 1 };
  if (d <= 7) return { k: 'jan', t: 'JANELA ABERTA', cls: 'jan', pr: 2 };
  return { k: 'prog', t: 'PROGRAMADO', cls: 'prog', pr: 6 };
}

export function fmtEta(e: string): string {
  if (!e) return '—';
  const [, m, d] = e.slice(0, 10).split('-');
  return `${d}/${m}`;
}

export function dLabel(d: number): string {
  if (!Number.isFinite(d)) return '—';
  return d < 0 ? `${Math.abs(d)}d atrás` : d === 0 ? 'hoje' : `em ${d}d`;
}

const TERM_MAP: Record<string, string> = {
  'EMBRAPORT EMPRESA BRASILEIRA DE TERMINAIS PORTUARIOS S/A': 'EMBRAPORT',
  'SANTOS BRASIL PARTICIPACOES S/A': 'SANTOS BRASIL',
  'BRASIL TERMINAL PORTUARIO S/A': 'BTP',
  'ECOPORTO SANTOS S/A': 'ECOPORTO',
};

export function shortTerm(s: string | undefined | null): string {
  if (!s) return '';
  const up = String(s).trim().toUpperCase();
  if (TERM_MAP[up]) return TERM_MAP[up];
  let t = up.replace(/\s+(S\/A|S\.A\.?|SA|LTDA|EIRELI|EPP|ME)\.?$/, '').trim();
  t = t.replace(/\s+(EMPRESA|PARTICIPACOES|TERMINAL|TERMINAIS|COMERCIAL)\b.*$/, '').trim() || t;
  if (t.length > 20) {
    const w = t.split(/\s+/);
    let out = w[0] || '';
    if (w[1] && (out + ' ' + w[1]).length <= 20) out += ' ' + w[1];
    t = out;
  }
  return t;
}
