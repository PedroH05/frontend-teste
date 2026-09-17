import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ClientesPage from '../page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/clientes',
}));

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

  it('apelido vira chip ao teclar Enter e some ao clicar no ✕', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([]);
    render(<ClientesPage />);
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/clientes'));

    const aliasInput = screen.getByPlaceholderText('digite e tecle Enter…');
    await user.type(aliasInput, 'tecno{Enter}');

    expect(screen.getByText('TECNO')).toBeInTheDocument();

    await user.click(screen.getByText('✕'));
    expect(screen.queryByText('TECNO')).not.toBeInTheDocument();
  });

  it('edita um cliente inline via PATCH /clientes/:id', async () => {
    const user = userEvent.setup();
    apiFetchMock
      .mockResolvedValueOnce([
        { id: 1, name: 'TECNO', cnpj: null, cnpjRaiz: null, aliases: [], ativo: true },
      ]) // load inicial
      .mockResolvedValueOnce({ id: 1, name: 'TECNO AMERICA', cnpj: null, cnpjRaiz: null, aliases: [], ativo: true }) // PATCH
      .mockResolvedValueOnce([
        { id: 1, name: 'TECNO AMERICA', cnpj: null, cnpjRaiz: null, aliases: [], ativo: true },
      ]); // reload após salvar

    render(<ClientesPage />);
    await screen.findByText('TECNO');

    await user.click(screen.getByTitle('Editar'));
    const nameInput = screen.getByDisplayValue('TECNO');
    await user.clear(nameInput);
    await user.type(nameInput, 'TECNO AMERICA');
    await user.click(screen.getByTitle('Salvar'));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/clientes/1',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    expect(await screen.findByText('TECNO AMERICA')).toBeInTheDocument();
  });

  it('pagina de 5 em 5, igual à Carteira e ao Histórico (pedido 17/09/2026)', async () => {
    const user = userEvent.setup();
    const clientes = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      name: `CLIENTE${i + 1}`,
      cnpj: null,
      cnpjRaiz: null,
      aliases: [],
      ativo: true,
    }));
    apiFetchMock.mockResolvedValueOnce(clientes);
    render(<ClientesPage />);

    await screen.findByText('CLIENTE1');
    expect(screen.getByText('CLIENTE5')).toBeInTheDocument();
    expect(screen.queryByText('CLIENTE6')).not.toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próxima ›' }));

    expect(screen.getByText('CLIENTE6')).toBeInTheDocument();
    expect(screen.queryByText('CLIENTE1')).not.toBeInTheDocument();
  });
});
