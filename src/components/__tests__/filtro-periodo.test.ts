import { describe, expect, it } from 'vitest';
import { estaNoPeriodo } from '../filtro-periodo';

// Lógica do filtro de/até do Histórico (pedido 13/10/2026). Não testa o
// popover em si (abrir o Base UI Popover trava em jsdom — sem layout
// real o clique no gatilho nunca resolve; mesmo motivo de hover-card.tsx
// nunca ter teste de abrir), só a matemática do intervalo que decide o
// que aparece na tabela.
describe('estaNoPeriodo', () => {
  const inicio = new Date(2026, 9, 1); // 01/10/2026
  const fim = new Date(2026, 9, 10); // 10/10/2026

  it('inclui a data de início', () => {
    expect(estaNoPeriodo(inicio, inicio, fim)).toBe(true);
  });

  it('inclui a data de fim (o dia inteiro, não só meia-noite)', () => {
    const fimAsNoite = new Date(2026, 9, 10, 23, 59);
    expect(estaNoPeriodo(fimAsNoite, inicio, fim)).toBe(true);
  });

  it('inclui dia dentro do intervalo', () => {
    expect(estaNoPeriodo(new Date(2026, 9, 5), inicio, fim)).toBe(true);
  });

  it('exclui dia antes do início', () => {
    expect(estaNoPeriodo(new Date(2026, 8, 30), inicio, fim)).toBe(false);
  });

  it('exclui dia depois do fim', () => {
    expect(estaNoPeriodo(new Date(2026, 9, 11), inicio, fim)).toBe(false);
  });

  it('funciona com início e fim no mesmo dia (período de um dia só)', () => {
    const dia = new Date(2026, 9, 24);
    expect(estaNoPeriodo(new Date(2026, 9, 24, 18, 30), dia, dia)).toBe(true);
    expect(estaNoPeriodo(new Date(2026, 9, 23), dia, dia)).toBe(false);
    expect(estaNoPeriodo(new Date(2026, 9, 25), dia, dia)).toBe(false);
  });
});
