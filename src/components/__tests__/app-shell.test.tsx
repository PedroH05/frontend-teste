import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../app-shell';
import { TooltipProvider } from '@/components/ui/tooltip';

const nav = vi.hoisted(() => ({ caminho: '/carteira' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => nav.caminho,
}));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: () => new Promise(() => {}) };
});

beforeAll(() => {
  // jsdom não tem matchMedia (useIsMobile do Sidebar usa) — sempre desktop.
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

describe('AppShell — sidebar recolhida', () => {
  afterEach(() => localStorage.clear());

  it('com a sidebar recolhida, o botão de expandir continua aparecendo e volta ao normal (bug 21/10/2026)', async () => {
    const user = userEvent.setup();
    localStorage.setItem('vt-sidebar', 'recolhida');
    render(
      <TooltipProvider>
        <AppShell>conteúdo</AppShell>
      </TooltipProvider>,
    );

    const expandir = await screen.findByRole('button', { name: 'Expandir menu' });
    expect(expandir).not.toHaveClass('group-data-[collapsible=icon]:hidden');

    await user.click(expandir);
    expect(await screen.findByRole('button', { name: 'Recolher menu' })).toBeInTheDocument();
    expect(localStorage.getItem('vt-sidebar')).toBe('aberta');
  });
});

describe('AppShell — direção do deslize no voltar/avançar do navegador (24/11/2026)', () => {
  afterEach(() => {
    delete document.documentElement.dataset.navDir;
    window.history.replaceState(null, '', '/');
    nav.caminho = '/carteira';
  });

  function montar() {
    render(
      <TooltipProvider>
        <AppShell>conteúdo</AppShell>
      </TooltipProvider>,
    );
  }

  it('voltar pra uma tela abaixo no menu desliza pra frente', () => {
    nav.caminho = '/carteira';
    montar();
    window.history.pushState(null, '', '/historico');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(document.documentElement.dataset.navDir).toBe('forward');
  });

  it('com View Transition no navegador, segura o popstate e reenvia dentro da transição', async () => {
    nav.caminho = '/historico';
    montar();
    const recebidos: PopStateEvent[] = [];
    const depois = (e: Event) => recebidos.push(e as PopStateEvent);
    window.addEventListener('popstate', depois); // registrado depois, como o do Next
    let atualizar: (() => unknown) | undefined;
    const finished = Promise.resolve();
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (cb: () => unknown) => {
        atualizar = cb;
        return { finished, ready: finished, updateCallbackDone: finished };
      },
    });
    try {
      window.history.pushState({ x: 1 }, '', '/carteira');
      window.dispatchEvent(new PopStateEvent('popstate', { state: { x: 1 } }));
      // o original não chega no listener do "Next": foi segurado
      expect(recebidos).toHaveLength(0);
      expect(document.documentElement.dataset.navManual).toBe('');
      expect(document.documentElement.dataset.navDir).toBe('back');
      // dentro da transição, o evento é reenviado com o mesmo state
      void atualizar?.();
      expect(recebidos).toHaveLength(1);
      expect(recebidos[0].state).toEqual({ x: 1 });
    } finally {
      window.removeEventListener('popstate', depois);
      delete (document as { startViewTransition?: unknown }).startViewTransition;
      delete document.documentElement.dataset.navManual;
    }
  });

  it('voltar pra uma tela acima no menu desliza pra trás', () => {
    nav.caminho = '/historico';
    montar();
    window.history.pushState(null, '', '/carteira');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(document.documentElement.dataset.navDir).toBe('back');
  });
});
