import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CaptacoesPage from '../page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/captacoes',
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

    // navega até o último passo (Revisão) sem preencher nada
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: 'Próximo ›' }));
    }
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // erro agora aparece junto do campo (stepper aponta o passo 1 com "!"),
    // não mais como banner solto — ver goToStep(0) em handleSubmit.
    expect(await screen.findByText('Campo obrigatório')).toBeInTheDocument();
    expect(screen.getByText('!')).toBeInTheDocument(); // stepper aponta o passo 1
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('salva e navega pro histórico, aplicando efetivada a partir do status', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce({});
    render(<CaptacoesPage />);

    await user.type(screen.getByLabelText('Cliente'), 'tecno');

    for (let i = 0; i < 5; i++) {
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

    // espera a animação do botão Salvar (1.4s) terminar antes de navegar —
    // ver shipButtonAway() em ../page.tsx.
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/historico'), { timeout: 2000 });
  });

  it('Enter num campo avança pra próxima etapa, sem precisar clicar em Próximo (pedido 16/09/2026)', async () => {
    const user = userEvent.setup();
    render(<CaptacoesPage />);

    expect(screen.getByLabelText('Cliente')).toBeInTheDocument(); // passo 1 (Identificação)
    await user.type(screen.getByLabelText('Cliente'), 'tecno{Enter}');

    expect(await screen.findByLabelText('ETA')).toBeInTheDocument(); // passo 2 (Carga)
    expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument();
  });
});
