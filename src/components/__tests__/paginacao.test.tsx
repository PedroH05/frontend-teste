import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Paginacao, paginasVisiveis } from '../paginacao';

describe('paginasVisiveis', () => {
  it('poucas páginas mostra todas', () => {
    expect(paginasVisiveis(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('muitas páginas: primeira, vizinhas da atual e última, com reticências', () => {
    expect(paginasVisiveis(1, 74)).toEqual([1, 2, 3, 4, '…', 74]);
    expect(paginasVisiveis(10, 74)).toEqual([1, '…', 9, 10, 11, '…', 74]);
    expect(paginasVisiveis(74, 74)).toEqual([1, '…', 71, 72, 73, 74]);
  });
});

describe('Paginacao', () => {
  it('clicar num número vai pra página; a atual fica marcada', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Paginacao pagina={2} totalPaginas={5} onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Página 4' }));
    expect(onChange).toHaveBeenCalledWith(4);
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
