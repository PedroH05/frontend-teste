import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import HistoricoPage from '../page';
import type { Captacao } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/historico',
}));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) };
});

function base(overrides: Partial<Captacao>): Captacao {
  return {
    id: 1,
    cli: 'TECNO',
    referencia: 'TECNO 001',
    eta: null,
    regime: 'DTA',
    bl: null,
    ce: null,
    container: null,
    quantidade: null,
    navio: 'MSC AMALFI',
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
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('HistoricoPage', () => {
  it('filtro "Tudo" (padrão) mostra captações de qualquer dia', async () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    apiFetchMock.mockResolvedValueOnce([
      base({ id: 1, cli: 'DE HOJE' }),
      base({ id: 2, cli: 'DE ONTEM', createdAt: ontem.toISOString() }),
    ]);

    render(<HistoricoPage />);

    expect(await screen.findByText('DE HOJE')).toBeInTheDocument();
    expect(screen.getByText('DE ONTEM')).toBeInTheDocument();
  });

  it('"Tudo" ordena por data de registro, não por ETA — captação sem ETA aparece primeiro se for a mais recente', async () => {
    // Regressão: até 16/09/2026 "Tudo" ordenava por ETA (igual ao sistema
    // antigo), então uma captação recém-criada sem ETA ia parar no fim de
    // uma lista paginada, "sumida" pra quem acabou de criar.
    const semana = new Date();
    semana.setDate(semana.getDate() - 7);
    apiFetchMock.mockResolvedValueOnce([
      base({ id: 1, cli: 'ANTIGA COM ETA', eta: '2026-12-31', createdAt: semana.toISOString() }),
      base({ id: 2, cli: 'NOVA SEM ETA', eta: null }),
    ]);

    render(<HistoricoPage />);
    await screen.findByText('NOVA SEM ETA');

    const linhas = screen.getAllByRole('row').map((r) => r.textContent ?? '');
    const idxNova = linhas.findIndex((t) => t.includes('NOVA SEM ETA'));
    const idxAntiga = linhas.findIndex((t) => t.includes('ANTIGA COM ETA'));
    expect(idxNova).toBeGreaterThan(-1);
    expect(idxNova).toBeLessThan(idxAntiga);
  });

  it('filtro "Hoje" mostra só captações registradas hoje', async () => {
    const user = userEvent.setup();
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    apiFetchMock.mockResolvedValueOnce([
      base({ id: 1, cli: 'DE HOJE' }),
      base({ id: 2, cli: 'DE ONTEM', createdAt: ontem.toISOString() }),
    ]);

    render(<HistoricoPage />);
    await screen.findByText('DE HOJE');
    await user.click(screen.getByRole('button', { name: 'Hoje' }));

    expect(screen.queryByText('DE ONTEM')).not.toBeInTheDocument();
  });

  it('filtro de status separa concluído/efetivado/em andamento', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([
      base({ id: 1, cli: 'CONCLUIDA', stage: 'SAIU_TERMINAL' }),
      base({ id: 2, cli: 'EFETIVADA', stage: 'EFETIVA' }),
      base({ id: 3, cli: 'ANDAMENTO', stage: 'MANIFESTADA' }),
    ]);

    render(<HistoricoPage />);
    await screen.findByText('CONCLUIDA');

    await user.selectOptions(screen.getByRole('combobox'), 'Efetivado');

    expect(screen.getByText('EFETIVADA')).toBeInTheDocument();
    expect(screen.queryByText('CONCLUIDA')).not.toBeInTheDocument();
    expect(screen.queryByText('ANDAMENTO')).not.toBeInTheDocument();
  });

  it('BL único aparece direto, sem badge', async () => {
    apiFetchMock.mockResolvedValueOnce([base({ id: 1, bl: 'HBCN066406' })]);
    render(<HistoricoPage />);
    expect(await screen.findByText('HBCN066406')).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it('excluir tira a linha da tela na hora, sem esperar um novo GET (achado testando com dado real)', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    apiFetchMock.mockResolvedValueOnce([base({ id: 1, cli: 'PRA EXCLUIR' })]); // GET inicial

    render(<HistoricoPage />);
    await screen.findByText('PRA EXCLUIR');

    apiFetchMock.mockClear();
    apiFetchMock.mockResolvedValueOnce(undefined); // DELETE
    await user.click(screen.getByTitle('Excluir'));

    expect(screen.queryByText('PRA EXCLUIR')).not.toBeInTheDocument();
    // Só o DELETE — nenhum GET novo depois de excluir (a Vercel pode
    // devolver a lista antiga por causa de cache, então a tela não deve
    // depender disso pra atualizar).
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/captacoes/1', { method: 'DELETE' });
  });

  it('múltiplos BL mostram badge "+N" que abre o drawer com a lista completa', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([
      base({ id: 1, bl: 'HBCN066406, HBCN066407, HBCN066408' }),
    ]);
    render(<HistoricoPage />);

    const badge = await screen.findByText('+2');
    await user.click(badge);

    expect(screen.getAllByText('HBCN066406')).toHaveLength(2); // célula truncada + drawer
    expect(screen.getByText('HBCN066407')).toBeInTheDocument();
    expect(screen.getByText('HBCN066408')).toBeInTheDocument();
    expect(screen.getByText('BL 3')).toBeInTheDocument();
  });
});
