import { beforeEach, describe, expect, it } from 'vitest';
import { applySidebarRecolhida, getSidebarRecolhida } from './sidebar';

describe('sidebar recolhida (pedido 06/10/2026)', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.sidebar;
  });

  it('padrão é aberta quando nada foi salvo', () => {
    expect(getSidebarRecolhida()).toBe(false);
  });

  it('guarda a escolha e reflete em data-sidebar na raiz', () => {
    applySidebarRecolhida(true);
    expect(getSidebarRecolhida()).toBe(true);
    expect(document.documentElement.dataset.sidebar).toBe('recolhida');

    applySidebarRecolhida(false);
    expect(getSidebarRecolhida()).toBe(false);
    expect(document.documentElement.dataset.sidebar).toBe('aberta');
  });
});
