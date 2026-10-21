import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../app-shell';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/carteira',
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
