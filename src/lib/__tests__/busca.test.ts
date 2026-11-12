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
});
