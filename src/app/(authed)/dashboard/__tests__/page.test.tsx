import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    dataCarregamento: null,
    transportadora: null,
    dataChegada: null, dataChegadaDestino: null,
    createdAt: old.toISOString(), // fora do período "mês" por padrão
    ...overrides,
  };
}


function valorKpi(label: string) {
  return screen.getByRole('group', { name: label }).querySelector('[data-slot="kpi-valor"]')?.textContent;
}

describe('DashboardPage', () => {
  it('"Total histórico" e "Tabela pública" não mudam com o filtro de período', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([
      cap({ id: 1, prejuizoPublico: true }), // fora do mês corrente
      cap({ id: 2 }),
    ]);
    render(<DashboardPage />);

    await screen.findByRole('group', { name: 'Total histórico' });
    await screen.findByText('Ritmo diário');
    expect(valorKpi('Total histórico')).toBe('2');
    expect(valorKpi('Tabela pública')).toBe('1');

    await user.click(screen.getByRole('tab', { name: 'Hoje' }));

    expect(valorKpi('Total histórico')).toBe('2');
    expect(valorKpi('Tabela pública')).toBe('1');
  });

  it('KPI "Captações" reflete o período selecionado', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([cap({ id: 1 }), cap({ id: 2 })]); // ambas fora do mês corrente
    render(<DashboardPage />);

    await screen.findByRole('group', { name: 'Captações' });
    await screen.findByText('Ritmo diário');
    expect(valorKpi('Captações')).toBe('0');

    await user.click(screen.getByRole('tab', { name: 'Total' }));
    expect(valorKpi('Captações')).toBe('2');
  });

  it('destaque compara com o mês anterior e mostra a projeção (redesign 21/10/2026)', async () => {
    const agora = new Date();
    const mesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 10, 12);
    apiFetchMock.mockResolvedValueOnce([
      cap({ id: 1, quantidade: 3, createdAt: agora.toISOString() }),
      cap({ id: 2, quantidade: 1, createdAt: agora.toISOString() }),
      cap({ id: 3, quantidade: 2, createdAt: mesPassado.toISOString() }),
    ]);
    render(<DashboardPage />);

    const destaque = await screen.findByRole('region', { name: 'Destaque do período' });
    await waitFor(() => expect(destaque.querySelector('.vt-dash-heronum')).toHaveTextContent('4'));
    expect(destaque).toHaveTextContent('+100%'); // 4 contra 2
    expect(destaque).toHaveTextContent('No ritmo atual');
    expect(destaque).toHaveTextContent('Melhor dia');
  });

  it('rotas mostram atracação → parceiro do período', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([
      cap({ id: 1, quantidade: 2, terminalDescarga: 'BTP', terminalCaptado: 'ECOPORTO' }),
    ]);
    render(<DashboardPage />);
    await screen.findByText('Ritmo diário');
    await user.click(screen.getByRole('tab', { name: 'Total' }));

    const rotas = screen.getByRole('region', { name: 'Rotas do período' });
    expect(within(rotas).getByText('BTP')).toBeInTheDocument();
    expect(within(rotas).getByText('ECOPORTO')).toBeInTheDocument();
    expect(rotas.querySelector('title')?.textContent).toBe('BTP → ECOPORTO: 2 contêineres');
  });
});

describe('TrendChart — gráfico de contêineres por mês', () => {
  const pontos = [
    { label: 'jul', n: 12 },
    { label: 'ago', n: 27 },
  ];

  it('sem passar o mouse, só o último mês mostra o número', () => {
    render(<TrendChart points={pontos} />);
    expect(screen.getByText('27')).toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });

  it('passar o mouse num mês mostra o total e a variação contra o anterior (pedido 16/09/2026)', () => {
    render(<TrendChart points={pontos} />);
    const ago = screen.getByText('ago').closest('g')!;

    fireEvent.mouseEnter(ago);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('27 contêineres');
    expect(tip).toHaveTextContent('▲ 125% vs jul');

    fireEvent.mouseLeave(ago);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
