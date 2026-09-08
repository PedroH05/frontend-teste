import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CaptacoesPage from '../page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) };
});

describe('CaptacoesPage', () => {
  it('bloqueia salvar sem cliente e volta pro passo 1', async () => {
    const user = userEvent.setup();
    render(<CaptacoesPage />);

    // navega até o último passo sem preencher nada
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole('button', { name: 'Próximo ›' }));
    }
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Informe ao menos o cliente.')).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('salva e navega pro histórico, aplicando efetivada a partir do status', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce({});
    render(<CaptacoesPage />);

    await user.type(screen.getByLabelText('Cliente'), 'tecno');

    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole('button', { name: 'Próximo ›' }));
    }
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/captacoes',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(apiFetchMock.mock.calls[0][1].body);
    expect(body.cli).toBe('TECNO');
    expect(body.efetivada).toBe(false); // status default é PENDENTE

    expect(pushMock).toHaveBeenCalledWith('/historico');
  });
});
