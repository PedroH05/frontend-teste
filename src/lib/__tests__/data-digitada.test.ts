import { describe, expect, it } from 'vitest';
import { fmtDataBR, lerDataBR, mascaraData, mesmaData } from '../data-digitada';

describe('mascaraData', () => {
  it('põe as barras enquanto digita', () => {
    expect(mascaraData('2')).toBe('2');
    expect(mascaraData('281')).toBe('28/1');
    expect(mascaraData('28112')).toBe('28/11/2');
    expect(mascaraData('28112026')).toBe('28/11/2026');
  });

  it('ignora o que não é dígito e corta em 8 dígitos', () => {
    expect(mascaraData('28-11-2026')).toBe('28/11/2026');
    expect(mascaraData(' 28.11.2026 ')).toBe('28/11/2026');
    expect(mascaraData('281120261')).toBe('28/11/2026');
  });

  it('ISO colado (aaaa-mm-dd) vira dd/mm/aaaa', () => {
    expect(mascaraData('2026-11-28')).toBe('28/11/2026');
  });
});

describe('lerDataBR', () => {
  it('lê data completa no fuso local', () => {
    const l = lerDataBR('28/11/2026');
    expect(l.estado).toBe('ok');
    if (l.estado === 'ok') expect(mesmaData(l.data, new Date(2026, 10, 28))).toBe(true);
  });

  it('ano com 2 dígitos vira 20aa', () => {
    const l = lerDataBR('05/12/26');
    expect(l.estado === 'ok' && fmtDataBR(l.data)).toBe('05/12/2026');
  });

  it('vazia, incompleta e impossível', () => {
    expect(lerDataBR('  ').estado).toBe('vazia');
    expect(lerDataBR('28/11').estado).toBe('incompleta');
    expect(lerDataBR('28/11/202').estado).toBe('incompleta');
    expect(lerDataBR('31/02/2026').estado).toBe('invalida');
    expect(lerDataBR('10/13/2026').estado).toBe('invalida');
    expect(lerDataBR('00/10/2026').estado).toBe('invalida');
    expect(lerDataBR('29/02/2028').estado).toBe('ok'); // bissexto
    expect(lerDataBR('29/02/2027').estado).toBe('invalida');
  });
});
