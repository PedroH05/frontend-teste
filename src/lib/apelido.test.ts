import { describe, expect, it } from 'vitest';
import { apelidoCliente } from './apelido';
import type { Cliente } from './types';

function cliente(overrides: Partial<Cliente>): Cliente {
  return { id: 1, name: 'TECNO AMERICA LTDA', cnpj: null, cnpjRaiz: null, aliases: [], ativo: true, ...overrides };
}

describe('apelidoCliente', () => {
  it('acha por CNPJ raiz, mesmo com texto digitado diferente do apelido', () => {
    const clientes = [cliente({ cnpjRaiz: '12345678', aliases: ['TECNO'] })];
    expect(apelidoCliente('algo digitado sem nada a ver', '12.345.678/0001-99', clientes)).toBe('TECNO');
  });

  it('sem CNPJ, acha pelo prefixo — "HUESKER LTDA" vira "HUESKER" (achado com dado real)', () => {
    const clientes = [cliente({ cnpjRaiz: null, aliases: ['HUESKER'] })];
    expect(apelidoCliente('HUESKER LTDA', null, clientes)).toBe('HUESKER');
  });

  it('sem casamento nenhum, mantém o texto original — nunca esconde dado', () => {
    const clientes = [cliente({ cnpjRaiz: '99999999', aliases: ['OUTRO'] })];
    expect(apelidoCliente('CLIENTE DESCONHECIDO', null, clientes)).toBe('CLIENTE DESCONHECIDO');
  });

  it('sem cli nenhum, devolve vazio sem quebrar', () => {
    expect(apelidoCliente(null, null, [])).toBe('');
    expect(apelidoCliente(undefined, undefined, [])).toBe('');
  });

  it('CNPJ tem prioridade sobre o casamento por prefixo', () => {
    const clientes = [
      cliente({ id: 1, cnpjRaiz: '11111111', aliases: ['CERTO'] }),
      cliente({ id: 2, cnpjRaiz: null, aliases: ['CLIENTE'] }), // prefixo de "CLIENTE X" também bateria
    ];
    expect(apelidoCliente('CLIENTE X', '11.111.111/0001-00', clientes)).toBe('CERTO');
  });
});
