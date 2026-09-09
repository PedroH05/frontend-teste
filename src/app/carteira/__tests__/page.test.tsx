import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CarteiraPage from '../page';
import type { CockpitRow } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) };
});

function row(overrides: Partial<CockpitRow>): CockpitRow {
  return {
    cnpj: '',
    cli: 'TECNO',
    ref: 'TECNO 001',
    eta: '2026-09-10',
    regime: 'DTA',
    ce: '',
    bl: '',
    navio: 'MSC AMALFI',
    cont: '',
    qtd: '1',
    desp: 'LOGMAIS',
    atrac: 'Santos Brasil',
    parc: 'ECOPORTO',
    stage: 'MANIFESTADA_PARC',
    capId: 1,
    ...overrides,
  };
}

describe('CarteiraPage', () => {
  it('mostra as 5 faixas de risco com a contagem correta', async () => {
    apiFetchMock.mockResolvedValueOnce({
      rows: [row({ stage: 'MANIFESTADA_DOCS' }), row({ stage: 'EFETIVA', capId: 2 })],
    });
    render(<CarteiraPage />);

    expect(await screen.findByText('Crítico')).toBeInTheDocument();
    expect(screen.getByText('Efetivado')).toBeInTheDocument();
  });

  it('alerta minimizável esconde e mostra o texto', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce({ rows: [] });
    render(<CarteiraPage />);

    await screen.findByText('Alerta de hoje');
    expect(screen.getByText(/janela de 7 dias/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '▾' }));
    expect(screen.queryByText(/janela de 7 dias/)).not.toBeInTheDocument();
  });

  it('busca reconhece um código de container e oferece rastreio', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce({ rows: [] });
    render(<CarteiraPage />);

    await screen.findByText('Alerta de hoje');
    await user.type(
      screen.getByPlaceholderText(/o que falta captar/),
      'MSDU7175720',
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText(/container/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rastrear no track-trace' })).toBeInTheDocument();
  });

  it('busca por palavra-chave "crítico" filtra a lista de risco', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce({
      rows: [row({ stage: 'MANIFESTADA_DOCS', cli: 'ALUZEN', ref: 'ALUZEN 002' })],
    });
    render(<CarteiraPage />);

    await screen.findByText('Alerta de hoje');
    await user.type(screen.getByPlaceholderText(/o que falta captar/), 'o que está crítico?');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText(/em estado crítico/)).toBeInTheDocument();
  });

  it('importa uma planilha e mostra o resumo estruturado, recarregando a carteira', async () => {
    const user = userEvent.setup();
    apiFetchMock
      .mockResolvedValueOnce({ rows: [] }) // load() inicial
      .mockResolvedValueOnce({ processados: 3, porCnpj: 2, provaveis: 1, ignorados: 5 }) // import
      .mockResolvedValueOnce({ rows: [row({})] }); // load() depois do import
    render(<CarteiraPage />);

    await screen.findByText('Alerta de hoje');
    const file = new File(['conteudo'], 'planilha.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await user.upload(screen.getByLabelText('Selecionar planilha do Logcomex'), file);

    expect(await screen.findByText(/processados/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/import/logcomex',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    // recarregou a carteira depois de importar (última chamada é GET /carteira de novo)
    const ultimaChamada = apiFetchMock.mock.calls.at(-1);
    expect(ultimaChamada?.[0]).toBe('/carteira');
  });
});
