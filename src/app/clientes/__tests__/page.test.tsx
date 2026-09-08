import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ClientesPage from '../page';

// ApiError real (não mockado) — o componente usa instanceof pra decidir a
// mensagem, então o mock precisa devolver a classe de verdade.
const { ApiError } = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) };
});

describe('ClientesPage', () => {
  it('mostra mensagem específica quando o backend responde 409 (raiz de CNPJ duplicada)', async () => {
    const user = userEvent.setup();
    apiFetchMock
      .mockResolvedValueOnce([]) // GET inicial (load no mount)
      .mockRejectedValueOnce(new ApiError(409, 'Já existe cliente cadastrado com essa raiz de CNPJ'));

    render(<ClientesPage />);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/clientes'));

    await user.type(screen.getByLabelText('Razão social / Nome'), 'Duplicado');
    await user.click(screen.getByRole('button', { name: '+ Adicionar cliente' }));

    expect(
      await screen.findByText('Já existe cliente cadastrado com essa raiz de CNPJ.'),
    ).toBeInTheDocument();
  });

  it('lista clientes carregados do backend', async () => {
    apiFetchMock.mockResolvedValueOnce([
      { id: 1, name: 'TECNO', cnpj: null, cnpjRaiz: '12345678', aliases: ['TECNOAMERICA'], ativo: true },
    ]);

    render(<ClientesPage />);

    expect(await screen.findByText('TECNO')).toBeInTheDocument();
    expect(screen.getByText('12345678')).toBeInTheDocument();
  });
});
