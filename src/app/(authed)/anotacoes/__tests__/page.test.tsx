import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AnotacoesPage from '../page';

// Mock por ROTA — mesmo padrão de carteira/historico/captacoes.
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
  return Promise.resolve(rest.length ? {} : undefined);
});
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...(args as [string])) };
});

describe('AnotacoesPage', () => {
  afterEach(() => {
    for (const k of Object.keys(filas)) delete filas[k];
    apiFetchMock.mockClear();
  });

  it('sem notas, mostra "Nenhuma anotação ainda." e "Crie uma nota pra começar."', async () => {
    filaApi('/notas', []);
    render(<AnotacoesPage />);

    expect(await screen.findByText('Nenhuma anotação ainda.')).toBeInTheDocument();
    expect(screen.getByText('Crie uma nota pra começar.')).toBeInTheDocument();
  });

  it('cria nota solta (sem captação), dá nome e salva — pedido 08/10/2026', async () => {
    const user = userEvent.setup();
    filaApi('/notas', []);
    render(<AnotacoesPage />);
    await screen.findByText('Nenhuma anotação ainda.');

    filaApi('/notas', {
      id: 1,
      captacaoId: null,
      titulo: 'Nova nota',
      texto: null,
      cor: null,
      fixada: false,
      createdAt: '2026-10-08T10:00:00.000Z',
      updatedAt: '2026-10-08T10:00:00.000Z',
    });
    await user.click(screen.getByRole('button', { name: '+ Nova nota' }));

    const campoTitulo = await screen.findByPlaceholderText('Nome da nota');
    expect(campoTitulo).toHaveValue('Nova nota');

    filaApi('/notas/1', {
      id: 1,
      captacaoId: null,
      titulo: 'Combinado com o chefe',
      texto: 'reunião quinta',
      cor: null,
      fixada: false,
      createdAt: '',
      updatedAt: '',
    });
    await user.clear(campoTitulo);
    await user.type(campoTitulo, 'Combinado com o chefe');
    await user.tab();

    expect(apiFetchMock.mock.calls.some((c) => c[0] === '/notas/1')).toBe(true);
    // sem captacaoId no corpo — nota solta, não presa a captação nenhuma
    const chamadaCriar = apiFetchMock.mock.calls.find((c) => c[0] === '/notas' && (c[1] as RequestInit)?.method === 'POST');
    expect(chamadaCriar).toBeTruthy();
  });
});
