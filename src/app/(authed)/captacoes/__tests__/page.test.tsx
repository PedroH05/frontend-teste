import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CaptacoesPage from '../page';

const pushMock = vi.fn();
const backMock = vi.fn();
const useSearchParamsMock = vi.fn(() => new URLSearchParams());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
  useSearchParams: () => useSearchParamsMock(),
  usePathname: () => '/captacoes',
}));

// Mock por ROTA, não por ordem de chamada — a tela busca /clientes em
// paralelo (sugestão + CNPJ automático, pedido 22/09/2026), então uma fila
// única desalinha o teste que espera só a chamada de salvar. Mesmo padrão
// de `carteira/__tests__/page.test.tsx`.
const filas: Record<string, unknown[]> = {};
function filaApi(path: string, valor: unknown) {
  (filas[path] ??= []).push(valor);
}
const apiFetchMock = vi.fn((path: string, ...rest: unknown[]) => {
  const fila = filas[path];
  if (fila?.length) {
    const proximo = fila.shift();
    return proximo instanceof Error ? Promise.reject(proximo) : Promise.resolve(proximo);
  }
  if (path === '/clientes') return Promise.resolve([]); // sem sugestão, campo continua livre
  return Promise.resolve(rest.length ? {} : undefined);
});
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...(args as [string])) };
});

describe('CaptacoesPage', () => {
  afterEach(() => {
    for (const k of Object.keys(filas)) delete filas[k];
    apiFetchMock.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

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
    expect(apiFetchMock).not.toHaveBeenCalledWith('/captacoes', expect.anything());
  });

  it('salva e navega pro histórico, aplicando efetivada a partir do status', async () => {
    const user = userEvent.setup();
    filaApi('/captacoes', {});
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
    const chamadaSalvar = apiFetchMock.mock.calls.find((c) => c[0] === '/captacoes' && c[1]);
    const body = JSON.parse((chamadaSalvar as [string, { body: string }])[1].body);
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

  it('sugere cliente cadastrado e preenche o CNPJ ao selecionar (pedido 22/09/2026)', async () => {
    const user = userEvent.setup();
    filaApi('/clientes', [
      { id: 1, name: 'HUESKER BRASIL LTDA', cnpj: '12.345.678/0001-99', cnpjRaiz: '12345678', aliases: ['HUESKER'], ativo: true },
    ]);
    render(<CaptacoesPage />);

    await user.type(screen.getByLabelText('Cliente'), 'hues');
    await user.click(await screen.findByRole('option', { name: /HUESKER/ }));

    expect(screen.getByLabelText('Cliente')).toHaveValue('HUESKER');
    expect(screen.getByLabelText('CNPJ do cliente')).toHaveValue('12.345.678/0001-99');
  });

  // As duas a seguir cobrem a lógica de `exibirDespCustom`/`despachanteEhCustom`
  // (page.tsx) sem abrir o popup do Select (@base-ui/react) — em jsdom ele não
  // abre via clique (sem layout real, o mesmo já valeria pros selects de
  // Regime/Atracação/Parceiro, nenhum testado dessa forma hoje). Em vez
  // disso, usa o prefill por query string (mesmo caminho usado ao chegar
  // pela Carteira) pra exercitar o valor inicial do campo.
  it('despachante padrão (pré-preenchido) aparece sem o campo de texto livre', async () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams({ cli: 'TECNO', despachante: 'NIRRON' }));
    const user = userEvent.setup();
    render(<CaptacoesPage />);
    await user.click(screen.getByRole('button', { name: 'Próximo ›' }));
    await user.click(screen.getByRole('button', { name: 'Próximo ›' }));

    expect(screen.getByRole('combobox', { name: 'Despachante' })).toHaveTextContent('NIRRON');
    expect(screen.queryByPlaceholderText('Nome do despachante')).not.toBeInTheDocument();
  });

  it('despachante fora da lista padrão aparece no campo de texto livre ("+ novo despachante")', async () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams({ cli: 'TECNO', despachante: 'NOVOLOG' }));
    const user = userEvent.setup();
    render(<CaptacoesPage />);
    await user.click(screen.getByRole('button', { name: 'Próximo ›' }));
    await user.click(screen.getByRole('button', { name: 'Próximo ›' }));

    expect(screen.getByPlaceholderText('Nome do despachante')).toHaveValue('NOVOLOG');
  });
});
