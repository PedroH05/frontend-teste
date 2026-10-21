import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import ConfigPage from '../page';

describe('ConfigPage', () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.statusTexto;
    delete document.documentElement.dataset.skin;
  });

  it('switch "Mostrar o nome do status" liga e grava a preferência', async () => {
    const user = userEvent.setup();
    render(<ConfigPage />);

    const sw = screen.getByRole('switch', { name: 'Mostrar o nome do status' });
    expect(sw).not.toBeChecked();

    await user.click(sw);
    expect(sw).toBeChecked();
    expect(document.documentElement.dataset.statusTexto).toBe('mostrar');
    expect(localStorage.getItem('vt-status-texto')).toBe('mostrar');
    expect(screen.getByText('Ligado: o nome aparece escrito no badge.')).toBeInTheDocument();
  });

  it('escolher o tema Clássico aplica e marca como atual', async () => {
    const user = userEvent.setup();
    render(<ConfigPage />);

    await user.click(screen.getByRole('radio', { name: /Clássico/ }));
    expect(document.documentElement.dataset.skin).toBe('classic');
    expect(screen.getByRole('radio', { name: /Clássico/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Novo/ })).not.toBeChecked();
  });
});
