import { describe, expect, it } from 'vitest';
import { fmtEta, dLabel } from './risco';

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
