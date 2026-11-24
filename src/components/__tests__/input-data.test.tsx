import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InputData } from '../input-data';

// Usado no DateField da Captação e no "De/Até" do filtro de Período do
// Histórico (pedido 24/11/2026). O popover do filtro não abre em jsdom
// (ver filtro-periodo.test.ts), então o comportamento do campo é testado
// aqui direto.
function Controlado({ inicial = null, onErro }: { inicial?: Date | null; onErro?: (m: string | null) => void }) {
  const [data, setData] = useState<Date | null>(inicial);
  return (
    <>
      <InputData aria-label="data" value={data} onChange={setData} onErro={onErro} />
      <span data-testid="valor">{data ? data.toDateString() : 'nada'}</span>
      <button type="button" onClick={() => setData(new Date(2026, 0, 2))}>
        por fora
      </button>
    </>
  );
}

describe('InputData', () => {
  it('só entrega a data quando o texto fica completo e válido', async () => {
    const user = userEvent.setup();
    render(<Controlado />);
    const campo = screen.getByLabelText('data');
    await user.type(campo, '2811');
    expect(campo).toHaveValue('28/11');
    expect(screen.getByTestId('valor')).toHaveTextContent('nada');
    await user.type(campo, '2026');
    expect(screen.getByTestId('valor')).toHaveTextContent(new Date(2026, 10, 28).toDateString());
  });

  it('apagar tudo limpa a data', async () => {
    const user = userEvent.setup();
    render(<Controlado inicial={new Date(2026, 10, 28)} />);
    const campo = screen.getByLabelText('data');
    expect(campo).toHaveValue('28/11/2026');
    await user.clear(campo);
    expect(screen.getByTestId('valor')).toHaveTextContent('nada');
  });

  it('incompleta reclama só ao sair do campo; impossível reclama na hora', async () => {
    const user = userEvent.setup();
    const onErro = vi.fn();
    render(<Controlado onErro={onErro} />);
    const campo = screen.getByLabelText('data');
    await user.type(campo, '2811');
    expect(onErro).not.toHaveBeenLastCalledWith('Data incompleta, use dd/mm/aaaa.');
    await user.tab();
    expect(onErro).toHaveBeenLastCalledWith('Data incompleta, use dd/mm/aaaa.');

    await user.clear(campo);
    await user.type(campo, '31022026');
    expect(onErro).toHaveBeenLastCalledWith('Data inválida, confira dia e mês.');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('valor')).toHaveTextContent('nada');
  });

  it('data trocada por fora (calendário, atalho) reescreve o texto', async () => {
    const user = userEvent.setup();
    render(<Controlado />);
    await user.click(screen.getByRole('button', { name: 'por fora' }));
    expect(screen.getByLabelText('data')).toHaveValue('02/01/2026');
  });
});
