import { describe, expect, it } from 'vitest';
import { listaConts } from './conteineres';

describe('listaConts', () => {
  it('separa por barra (caso real do Histórico)', () => {
    expect(listaConts('MSBU703088-5/MSMU705415-5/MSMU555755-1/MSBU450468-2')).toEqual([
      'MSBU703088-5',
      'MSMU705415-5',
      'MSMU555755-1',
      'MSBU450468-2',
    ]);
  });

  it('mantém o hífen dentro do código e separa por espaço e vírgula', () => {
    expect(listaConts('MSCU452849-8, GCNU4764139')).toEqual(['MSCU452849-8', 'GCNU4764139']);
  });

  it('vazio ou nulo devolve lista vazia', () => {
    expect(listaConts(null)).toEqual([]);
    expect(listaConts('')).toEqual([]);
  });
});
