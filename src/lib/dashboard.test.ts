import { describe, expect, it } from 'vitest';
import { capDate, noPeriodo, qtd, sumBy, ym } from './dashboard';
import type { Captacao } from './types';

function cap(overrides: Partial<Captacao>): Captacao {
  return {
    id: 1,
    cli: 'TECNO',
    referencia: null,
    eta: null,
    regime: null,
    bl: null,
    ce: null,
    container: null,
    quantidade: null,
    navio: null,
    despachante: null,
    terminalDescarga: null,
    terminalCaptado: null,
    observacao: null,
    cnpj: null,
    stage: null,
    docBl: null,
    docCe: null,
    docPl: null,
    docRecebidaEm: null,
    prejuizoPublico: null,
    dateLabel: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('noPeriodo — filtro rápido usa created_at, não ETA', () => {
  const now = new Date(2026, 8, 8, 12, 0, 0); // 08/09/2026 (terça)

  it('"hoje" bate com created_at de hoje, mesmo com ETA em outro dia', () => {
    const c = cap({ createdAt: new Date(2026, 8, 8, 9).toISOString(), eta: '2026-12-25' });
    expect(noPeriodo(c, 'hoje', now)).toBe(true);
  });

  it('"hoje" não bate se created_at for de outro dia, mesmo com ETA hoje', () => {
    const c = cap({ createdAt: new Date(2026, 8, 1, 9).toISOString(), eta: '2026-09-08' });
    expect(noPeriodo(c, 'hoje', now)).toBe(false);
  });

  it('"semana" cobre segunda a domingo da semana corrente', () => {
    const segunda = cap({ createdAt: new Date(2026, 8, 7, 8).toISOString() }); // segunda
    const domingoAnterior = cap({ createdAt: new Date(2026, 8, 6, 23).toISOString() }); // domingo passado
    expect(noPeriodo(segunda, 'semana', now)).toBe(true);
    expect(noPeriodo(domingoAnterior, 'semana', now)).toBe(false);
  });

  it('"mes" cobre o mês e ano corrente', () => {
    const dentro = cap({ createdAt: new Date(2026, 8, 1).toISOString() });
    const fora = cap({ createdAt: new Date(2026, 7, 30).toISOString() });
    expect(noPeriodo(dentro, 'mes', now)).toBe(true);
    expect(noPeriodo(fora, 'mes', now)).toBe(false);
  });

  it('"total" sempre bate, independente da data', () => {
    expect(noPeriodo(cap({ createdAt: '2020-01-01T00:00:00Z' }), 'total', now)).toBe(true);
  });
});

describe('capDate — regra própria pro gráfico de evolução (date_label → eta → created_at)', () => {
  it('prioriza date_label quando está no formato DD/MM/AAAA', () => {
    const c = cap({ dateLabel: '15/03/2026', eta: '2026-09-08', createdAt: '2026-01-01T00:00:00Z' });
    const d = capDate(c)!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2); // março
    expect(d.getDate()).toBe(15);
  });

  it('cai pra ETA quando date_label não bate no formato', () => {
    const c = cap({ dateLabel: 'não é data', eta: '2026-05-20', createdAt: '2026-01-01T00:00:00Z' });
    const d = capDate(c)!;
    expect(d.getMonth()).toBe(4); // maio
  });

  it('cai pra created_at quando não há date_label nem eta', () => {
    const c = cap({ dateLabel: null, eta: null, createdAt: '2026-07-10T00:00:00Z' });
    const d = capDate(c)!;
    expect(d.getMonth()).toBe(6); // julho
  });
});

describe('qtd / ym / sumBy', () => {
  it('qtd sem quantidade conta como 1 contêiner', () => {
    expect(qtd(cap({ quantidade: null }))).toBe(1);
    expect(qtd(cap({ quantidade: 5 }))).toBe(5);
  });

  it('ym formata ano-mês com 2 dígitos', () => {
    expect(ym(new Date(2026, 0, 15))).toBe('2026-01');
  });

  it('sumBy agrupa e soma contêineres, ordenado do maior pro menor', () => {
    const lista = [cap({ cli: 'A', quantidade: 2 }), cap({ cli: 'B', quantidade: 5 }), cap({ cli: 'A', quantidade: 1 })];
    expect(sumBy(lista, (c) => c.cli)).toEqual([
      ['B', 5],
      ['A', 3],
    ]);
  });
});
