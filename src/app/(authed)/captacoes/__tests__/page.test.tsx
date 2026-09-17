import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CaptacoesPage from '../page';

const pushMock = vi.fn();
const backMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
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

  it('bolinha da etapa fica amarela (parcial) ou verde (completa) conforme o preenchimento — pedido 17/09/2026', async () => {
    const user = userEvent.setup();
    render(<CaptacoesPage />);

    // só "Cliente" preenchido dos 3 campos da etapa 1 (cnpj, cli, referencia)
    await user.type(screen.getByLabelText('Cliente'), 'TECNO');
    await user.click(screen.getByRole('button', { name: 'Próximo ›' }));

    const botaoEtapa1 = screen.getByRole('button', { name: /Identificação/ });
    expect(botaoEtapa1.querySelector('span')).toHaveStyle({ background: 'var(--vt-c-jan)' });
    expect(botaoEtapa1.querySelector('span')?.textContent).toBe('1'); // parcial não vira ✓

    await user.click(screen.getByRole('button', { name: '‹ Anterior' }));
    await user.type(screen.getByLabelText('Referência'), 'REF001');
    await user.type(screen.getByLabelText('CNPJ do cliente'), '12.345.678/0001-99');
    await user.click(screen.getByRole('button', { name: 'Próximo ›' }));

    expect(botaoEtapa1.querySelector('span')).toHaveStyle({ background: 'var(--vt-c-efet)' });
    expect(botaoEtapa1.querySelector('span')?.textContent).toBe('✓');
  });

  it('avisa antes de sair da tela clicando num link, se tiver dado digitado não salvo — pedido 17/09/2026', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<CaptacoesPage />);
    await user.type(screen.getByLabelText('Cliente'), 'TECNO');

    const link = document.createElement('a');
    link.href = '/carteira';
    document.body.appendChild(link);
    const naoCancelado = fireEvent.click(link);

    expect(confirmSpy).toHaveBeenCalled();
    expect(naoCancelado).toBe(false); // clique foi bloqueado (preventDefault)

    document.body.removeChild(link);
    confirmSpy.mockRestore();
  });

  it('não avisa ao clicar num link se nada foi digitado ainda', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<CaptacoesPage />);

    const link = document.createElement('a');
    link.href = '/carteira';
    link.addEventListener('click', (e) => e.preventDefault()); // evita jsdom tentar navegar de verdade
    document.body.appendChild(link);
    fireEvent.click(link);

    expect(confirmSpy).not.toHaveBeenCalled();

    document.body.removeChild(link);
    confirmSpy.mockRestore();
  });

  it('botão "Sair" volta sem perguntar quando nada foi digitado — pedido 17/09/2026', async () => {
    const user = userEvent.setup();
    render(<CaptacoesPage />);

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(backMock).toHaveBeenCalled();
  });

  it('botão "Sair" confirma antes de sair quando há dado digitado não salvo', async () => {
    const user = userEvent.setup();
    backMock.mockClear(); // isola do teste anterior, que já chamou back()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<CaptacoesPage />);
    await user.type(screen.getByLabelText('Cliente'), 'TECNO');

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(backMock).not.toHaveBeenCalled(); // cancelou no confirm — não navega

    confirmSpy.mockRestore();
  });
});
