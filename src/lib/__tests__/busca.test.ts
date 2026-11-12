import { describe, it, expect } from 'vitest';
import { criarFiltroBusca, normalizarBusca } from '../busca';

describe('normalizarBusca', () => {
  it('remove NBSP, zero-width, quebra de linha, acento e caixa', () => {
    expect(normalizarBusca('  REF 123​\n  Ação ')).toBe('ref 123 acao');
  });
});

describe('criarFiltroBusca', () => {
  const reg = { referencia: 'ABC 2024/123', cli: 'Aluzen Comércio', quantidade: 12 };

  it('consulta vazia não filtra', () => {
    expect(criarFiltroBusca('   ')).toBeNull();
  });
  it('acha texto colado com NBSP e caractere invisível', () => {
    expect(criarFiltroBusca('ABC 2024/123​')!(reg)).toBe(true);
  });
  it('acha texto colado com quebra de linha/tab no meio', () => {
    expect(criarFiltroBusca('\tABC\n2024/123\r\n')!(reg)).toBe(true);
  });
  it('ignora acento', () => {
    expect(criarFiltroBusca('comercio')!(reg)).toBe(true);
  });
  it('ignora separador diferente (-, /, espaço)', () => {
    expect(criarFiltroBusca('ABC-2024-123')!(reg)).toBe(true);
  });
  it('acha número', () => {
    expect(criarFiltroBusca('12')!(reg)).toBe(true);
  });
  it('não casa texto que não existe', () => {
    expect(criarFiltroBusca('XYZ999')!(reg)).toBe(false);
  });
  it('não junta campos diferentes no modo compacto', () => {
    expect(criarFiltroBusca('123aluzen')!(reg)).toBe(false);
  });
  it('não casa referência numérica com data (bug 12/11/2026)', () => {
    const outra = { referencia: 'XYZ 777', cli: 'OUTRA', createdAt: '2026-11-12T10:00:00.000Z', docRecebidaEm: '2026-11-12' };
    expect(criarFiltroBusca('2611')!(outra)).toBe(false);
    expect(criarFiltroBusca('20261112')!(outra)).toBe(false);
  });
  it('ignora prefixo colado do e-mail ("Ref.:", "Nossa ref.")', () => {
    expect(criarFiltroBusca('Ref.: ABC 2024/123')!(reg)).toBe(true);
    expect(criarFiltroBusca('Nossa ref. ABC2024123')!(reg)).toBe(true);
  });
  it('busca por palavras: todas precisam aparecer, em qualquer ordem e campo', () => {
    expect(criarFiltroBusca('aluzen 2024')!(reg)).toBe(true);
    expect(criarFiltroBusca('123 ABC')!(reg)).toBe(true);
    expect(criarFiltroBusca('aluzen 999')!(reg)).toBe(false);
  });
  it('só prefixo/palavra curta não vira "acha tudo"', () => {
    expect(criarFiltroBusca('ref')!({ cli: 'OUTRA' })).toBe(false);
    expect(criarFiltroBusca('a b')!({ cli: 'OUTRA' })).toBe(false);
  });
  it('modo compacto só vale em campos de identificação, não em texto livre', () => {
    expect(criarFiltroBusca('aluzencomercio')!(reg)).toBe(false);
    expect(criarFiltroBusca('abc2024123')!(reg)).toBe(true);
  });
});
