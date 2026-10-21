import { describe, expect, it } from 'vitest';
import {
  fluxosRotas,
  mapaDeCalor,
  melhorDia,
  noPeriodoAnterior,
  projecaoMes,
  sequenciaDiasUteis,
  serieMensal,
  variacaoPct,
} from '../dashboard';
import type { Captacao } from '../types';

function cap(o: Partial<Captacao>): Captacao {
  return {
    id: 1, cli: 'TECNO', referencia: null, eta: null, regime: null, bl: null, ce: null, container: null,
    quantidade: null, navio: null, despachante: null, terminalDescarga: null, terminalCaptado: null,
    observacao: null, cnpj: null, stage: null, docBl: null, docCe: null, docPl: null, docRecebidaEm: null,
    prejuizoPublico: null, dateLabel: null, dataCarregamento: null, transportadora: null, dataChegada: null,
    dataChegadaDestino: null, createdAt: new Date().toISOString(), ...o,
  };
}

// quarta-feira, 14/10/2026, meio-dia local
const AGORA = new Date(2026, 9, 14, 12);
const em = (d: number, m = 9, y = 2026) => new Date(y, m, d, 10).toISOString();

describe('lib/dashboard — contas do Dashboard redesenhado', () => {
  it('noPeriodoAnterior: mês anterior, ontem e semana passada', () => {
    expect(noPeriodoAnterior(cap({ createdAt: em(3, 8) }), 'mes', AGORA)).toBe(true);
    expect(noPeriodoAnterior(cap({ createdAt: em(3) }), 'mes', AGORA)).toBe(false);
    expect(noPeriodoAnterior(cap({ createdAt: em(13) }), 'hoje', AGORA)).toBe(true);
    expect(noPeriodoAnterior(cap({ createdAt: em(8) }), 'semana', AGORA)).toBe(true);
    expect(noPeriodoAnterior(cap({ createdAt: em(1, 0, 2020) }), 'total', AGORA)).toBe(false);
  });

  it('variacaoPct: sem base anterior não inventa porcentagem', () => {
    expect(variacaoPct(4, 2)).toBe(100);
    expect(variacaoPct(1, 4)).toBe(-75);
    expect(variacaoPct(5, 0)).toBeNull();
  });

  it('projecaoMes: ritmo até hoje × dias do mês', () => {
    expect(projecaoMes(28, AGORA)).toBe(62); // 28 em 14 dias, outubro tem 31
  });

  it('melhorDia soma contêineres por dia de registro', () => {
    const m = melhorDia([
      cap({ quantidade: 2, createdAt: em(10) }),
      cap({ quantidade: 3, createdAt: em(10) }),
      cap({ quantidade: 4, createdAt: em(11) }),
    ]);
    expect(m?.conteineres).toBe(5);
    expect(m?.dia.getDate()).toBe(10);
  });

  it('serieMensal conta contêineres, captações e clientes distintos (por capDate)', () => {
    const s = serieMensal(
      [
        cap({ cli: 'A', quantidade: 2, eta: '2026-10-05' }),
        cap({ cli: 'A', quantidade: 1, eta: '2026-10-20' }),
        cap({ cli: 'B', eta: '2026-09-01' }),
      ],
      AGORA,
    );
    expect(s).toHaveLength(6);
    expect(s[5]).toMatchObject({ conteineres: 3, captacoes: 2, clientes: 1 });
    expect(s[4]).toMatchObject({ conteineres: 1, captacoes: 1, clientes: 1 });
  });

  it('fluxosRotas ignora captação sem atracação ou parceiro e ordena pelo maior', () => {
    const f = fluxosRotas([
      cap({ terminalDescarga: 'BTP', terminalCaptado: 'ECOPORTO', quantidade: 1 }),
      cap({ terminalDescarga: 'DPW', terminalCaptado: 'DPW', quantidade: 3 }),
      cap({ terminalDescarga: 'BTP', terminalCaptado: null }),
    ]);
    expect(f).toEqual([
      { de: 'DPW', para: 'DPW', conteineres: 3 },
      { de: 'BTP', para: 'ECOPORTO', conteineres: 1 },
    ]);
  });

  it('mapaDeCalor: 16 semanas de segunda a domingo, termina na semana atual', () => {
    const m = mapaDeCalor([cap({ createdAt: em(14) }), cap({ createdAt: em(14) })], AGORA);
    expect(m).toHaveLength(16);
    const ultima = m[15];
    expect(ultima[0].dia.getDay()).toBe(1); // segunda
    expect(ultima[2].n).toBe(2); // quarta 14/10
    expect(ultima[3].futuro).toBe(true);
  });

  it('sequenciaDiasUteis pula fim de semana e começa de ontem se hoje ainda não teve', () => {
    const lista = [em(8), em(9), em(12), em(13)].map((createdAt) => cap({ createdAt })); // qui, sex, seg, ter
    expect(sequenciaDiasUteis(lista, AGORA)).toBe(4);
    expect(sequenciaDiasUteis([cap({ createdAt: em(12) })], AGORA)).toBe(0);
  });
});
