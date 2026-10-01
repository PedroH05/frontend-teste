import { describe, expect, it } from 'vitest';
import { banda, fmtEta, dLabel } from './risco';
import type { CockpitRow } from './types';

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function row(overrides: Partial<CockpitRow>): CockpitRow {
  return {
    cnpj: '',
    cli: 'TECNO',
    ref: 'TECNO 001',
    eta: '',
    regime: '',
    ce: '',
    bl: '',
    navio: '',
    cont: '',
    qtd: '1',
    desp: '',
    atrac: '',
    parc: '',
    stage: 'MANIFESTADA_PARC',
    capId: 1,
    createdAt: null,
    ...overrides,
  };
}

describe('fmtEta', () => {
  it('formata DD/MM/AAAA — igual ao Histórico (padronizado 17/09/2026, antes só DD/MM)', () => {
    expect(fmtEta('2026-09-20')).toBe('20/09/2026');
  });

  it('aceita timestamp completo, usa só a data', () => {
    expect(fmtEta('2026-01-05T00:00:00.000Z')).toBe('05/01/2026');
  });

  it('sem ETA → travessão', () => {
    expect(fmtEta('')).toBe('—');
  });
});

describe('banda (pedido 01/10/2026: Crítico/Próximos 7 dias decididos pelo ETA)', () => {
  it('EFETIVA sempre vira Efetivado, não importa o ETA', () => {
    expect(banda(row({ stage: 'EFETIVA', eta: isoDaysFromNow(1) })).k).toBe('efet');
  });

  it('doc completo (MANIFESTADA_DOCS) é sempre Crítico, mesmo com ETA distante', () => {
    expect(banda(row({ stage: 'MANIFESTADA_DOCS', eta: isoDaysFromNow(30) })).k).toBe('prej');
  });

  it('doc incompleto (MANIFESTADA_PARC) com ETA em 1 dia agora é Crítico, não mais "Em andamento"', () => {
    expect(banda(row({ stage: 'MANIFESTADA_PARC', eta: isoDaysFromNow(1) })).k).toBe('prej');
  });

  it('doc incompleto com ETA em 5 dias vira "Próximos 7 dias", não "Em andamento"', () => {
    expect(banda(row({ stage: 'MANIFESTADA_PARC', eta: isoDaysFromNow(5) })).k).toBe('jan');
  });

  it('doc incompleto com ETA distante continua "Em andamento"', () => {
    expect(banda(row({ stage: 'MANIFESTADA_PARC', eta: isoDaysFromNow(30) })).k).toBe('and');
  });

  it('sem captação casada (NENHUM), ETA próximo também vira Crítico', () => {
    expect(banda(row({ stage: 'NENHUM', capId: null, eta: isoDaysFromNow(2) })).k).toBe('prej');
  });
});

describe('dLabel', () => {
  it('hoje, atrás e à frente', () => {
    expect(dLabel(0)).toBe('hoje');
    expect(dLabel(3)).toBe('em 3d');
    expect(dLabel(-2)).toBe('2d atrás');
  });

  it('sem valor finito → travessão', () => {
    expect(dLabel(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
