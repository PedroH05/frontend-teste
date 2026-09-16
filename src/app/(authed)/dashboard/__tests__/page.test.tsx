import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DashboardPage, { TrendChart } from '../page';
import type { Captacao } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
}));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) };
});

function cap(overrides: Partial<Captacao>): Captacao {
  const old = new Date();
  old.setMonth(old.getMonth() - 3);
  return {
    id: 1,
    cli: 'TECNO',
    referencia: null,
    eta: null,
    regime: null,
    bl: null,
    ce: null,
    container: null,
    quantidade: null,
    navio: null,
    despachante: null,
    terminalDescarga: null,
    terminalCaptado: null,
    observacao: null,
    cnpj: null,
    stage: null,
    docBl: null,
    docCe: null,
    docPl: null,
    docRecebidaEm: null,
    prejuizoPublico: null,
    dateLabel: null,
    createdAt: old.toISOString(), // fora do período "mês" por padrão
    ...overrides,
  };
}

describe('DashboardPage', () => {
  it('"Total histórico" e "Tabela pública" não mudam com o filtro de período', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([
      cap({ id: 1, prejuizoPublico: true }), // fora do mês corrente
      cap({ id: 2 }),
    ]);
    render(<DashboardPage />);

    await screen.findByText('Total histórico');
    // 2 captações no total, independente do período "mês" (padrão) filtrar 0.
    const totalCard = screen.getByText('Total histórico').previousSibling;
    expect(totalCard?.textContent).toBe('2');
    const publicaCard = screen.getByText('Tabela pública').previousSibling;
    expect(publicaCard?.textContent).toBe('1');

    await user.click(screen.getByRole('button', { name: 'Hoje' }));

    expect(screen.getByText('Total histórico').previousSibling?.textContent).toBe('2');
    expect(screen.getByText('Tabela pública').previousSibling?.textContent).toBe('1');
  });

  it('KPI "Captações" reflete o período selecionado', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([cap({ id: 1 }), cap({ id: 2 })]); // ambas fora do mês corrente
    render(<DashboardPage />);

    await screen.findByText(/Captações · /);
    expect(screen.getByText(/Captações · /).previousSibling?.textContent).toBe('0');

    await user.click(screen.getByRole('button', { name: 'Total' }));
    expect(screen.getByText(/Captações · /).previousSibling?.textContent).toBe('2');
  });
});

describe('TrendChart — gráfico de contêineres por mês', () => {
  it('sem passar o mouse, só o último mês mostra o número', () => {
    const { container } = render(
      <TrendChart points={[{ label: 'jul', n: 12 }, { label: 'ago', n: 27 }]} />,
    );
    expect(screen.getByText('27')).toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
    expect(container.querySelectorAll('circle[r="10"]')).toHaveLength(2);
  });

  it('passar o mouse numa bolinha que não é a última mostra o total daquele mês (pedido 16/09/2026)', () => {
    const { container } = render(
      <TrendChart points={[{ label: 'jul', n: 12 }, { label: 'ago', n: 27 }]} />,
    );
    const grupoJul = container.querySelectorAll('g')[0];

    fireEvent.mouseEnter(grupoJul);
    expect(screen.getByText('12')).toBeInTheDocument();

    fireEvent.mouseLeave(grupoJul);
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });
});
