import { describe, expect, it } from 'vitest';
import { tipoTransicao } from '../transicao';

// Direção do deslize entre telas (pedido 24/11/2026): descer no menu
// entra pela direita, subir entra pela esquerda.
describe('tipoTransicao', () => {
  it('descer no menu vai pra frente, subir volta', () => {
    expect(tipoTransicao('/carteira', '/historico')).toBe('nav-forward');
    expect(tipoTransicao('/historico', '/dashboard')).toBe('nav-back');
    expect(tipoTransicao('/config', '/carteira')).toBe('nav-back');
  });

  it('Nova captação fica logo depois da Carteira', () => {
    expect(tipoTransicao('/carteira', '/captacoes')).toBe('nav-forward');
    expect(tipoTransicao('/historico', '/captacoes')).toBe('nav-back');
    expect(tipoTransicao('/captacoes', '/historico')).toBe('nav-forward');
  });

  it('ignora query e subcaminho', () => {
    expect(tipoTransicao('/historico', '/captacoes?edit=1&step=6')).toBe('nav-back');
    expect(tipoTransicao('/clientes/123', '/carteira')).toBe('nav-back');
  });

  it('tela fora da lista (ou sem origem) vai pra frente', () => {
    expect(tipoTransicao(null, '/carteira')).toBe('nav-forward');
    expect(tipoTransicao('/login', '/carteira')).toBe('nav-forward');
    expect(tipoTransicao('/carteira', '/carteirax')).toBe('nav-forward');
  });
});
