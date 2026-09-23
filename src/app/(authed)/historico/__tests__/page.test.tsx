import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HistoricoPage from '../page';
import type { Captacao } from '@/lib/types';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/historico',
}));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) };
});

function base(overrides: Partial<Captacao>): Captacao {
  return {
    id: 1,
    cli: 'TECNO',
    referencia: 'TECNO 001',
    eta: null,
    regime: 'DTA',
    bl: null,
    ce: null,
    container: null,
    quantidade: null,
    navio: 'MSC AMALFI',
    despachante: null,
    terminalDescarga: null,
    terminalCaptado: null,
    observacao: null,
    cnpj: null,
    stage: null,
    docBl: null,
    docCe: null,
    docPl: null,
    docRecebidaEm: null,
    prejuizoPublico: null,
    dateLabel: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('HistoricoPage', () => {
  afterEach(() => {
    apiFetchMock.mockReset();
    pushMock.mockClear();
  });

  it('filtro "Tudo" (padrão) mostra captações de qualquer dia', async () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    apiFetchMock.mockResolvedValueOnce([
      base({ id: 1, cli: 'DE HOJE' }),
      base({ id: 2, cli: 'DE ONTEM', createdAt: ontem.toISOString() }),
    ]);

    render(<HistoricoPage />);

    expect(await screen.findByText('DE HOJE')).toBeInTheDocument();
    expect(screen.getByText('DE ONTEM')).toBeInTheDocument();
  });

  it('"Tudo" ordena por data de registro, não por ETA — captação sem ETA aparece primeiro se for a mais recente', async () => {
    // Regressão: até 16/09/2026 "Tudo" ordenava por ETA (igual ao sistema
    // antigo), então uma captação recém-criada sem ETA ia parar no fim de
    // uma lista paginada, "sumida" pra quem acabou de criar.
    const semana = new Date();
    semana.setDate(semana.getDate() - 7);
    apiFetchMock.mockResolvedValueOnce([
      base({ id: 1, cli: 'ANTIGA COM ETA', eta: '2026-12-31', createdAt: semana.toISOString() }),
      base({ id: 2, cli: 'NOVA SEM ETA', eta: null }),
    ]);

    render(<HistoricoPage />);
    await screen.findByText('NOVA SEM ETA');

    const linhas = screen.getAllByRole('row').map((r) => r.textContent ?? '');
    const idxNova = linhas.findIndex((t) => t.includes('NOVA SEM ETA'));
    const idxAntiga = linhas.findIndex((t) => t.includes('ANTIGA COM ETA'));
    expect(idxNova).toBeGreaterThan(-1);
    expect(idxNova).toBeLessThan(idxAntiga);
  });

  it('filtro "Hoje" mostra só captações registradas hoje', async () => {
    const user = userEvent.setup();
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    apiFetchMock.mockResolvedValueOnce([
      base({ id: 1, cli: 'DE HOJE' }),
      base({ id: 2, cli: 'DE ONTEM', createdAt: ontem.toISOString() }),
    ]);

    render(<HistoricoPage />);
    await screen.findByText('DE HOJE');
    await user.click(screen.getByRole('button', { name: 'Hoje' }));

    expect(screen.queryByText('DE ONTEM')).not.toBeInTheDocument();
  });

  it('filtro de status separa concluído/efetivado/em andamento', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([
      base({ id: 1, cli: 'CONCLUIDA', stage: 'SAIU_TERMINAL' }),
      base({ id: 2, cli: 'EFETIVADA', stage: 'EFETIVA' }),
      base({ id: 3, cli: 'ANDAMENTO', stage: 'MANIFESTADA' }),
    ]);

    render(<HistoricoPage />);
    await screen.findByText('CONCLUIDA');

    await user.selectOptions(screen.getByRole('combobox'), 'Efetivado');

    expect(screen.getByText('EFETIVADA')).toBeInTheDocument();
    expect(screen.queryByText('CONCLUIDA')).not.toBeInTheDocument();
    expect(screen.queryByText('ANDAMENTO')).not.toBeInTheDocument();
  });

  // Segunda rodada (pedido 23/09/2026): sem drawer, sem editar/excluir na
  // linha — clicar no processo leva direto pro passo 6 (Revisão) do
  // formulário de captação, que já mostra tudo (BL incluído) e já tem
  // editar/excluir. BL/CE/Regime/Navio saíram da tabela, só Despachante e
  // Atracação → Parceiro voltaram junto de Registrado em.
  it('busca ignora espaço no final (pedido 17/09/2026)', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([base({ id: 1, bl: 'HBCN066406' })]);
    render(<HistoricoPage />);
    await screen.findByText('TECNO'); // cliente do base() padrão

    // BL não aparece como texto na tabela do Histórico — busca por ele com
    // espaço no final e confere que a linha continua lá.
    await user.type(screen.getByPlaceholderText('buscar cliente, BL, navio…'), 'HBCN066406 ');

    expect(screen.getByText('TECNO')).toBeInTheDocument();
  });

  it('clicar num processo leva direto pro passo 6 (Revisão) da edição', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([base({ id: 7, cli: 'TECNO' })]);
    render(<HistoricoPage />);
    await screen.findByText('TECNO');

    await user.click(screen.getByText('TECNO'));

    expect(pushMock).toHaveBeenCalledWith('/captacoes?edit=7&step=5');
  });

  it('despachante e atracação → parceiro aparecem na tabela', async () => {
    apiFetchMock.mockResolvedValueOnce([
      base({ id: 1, despachante: 'LOGMAIS', terminalDescarga: 'Santos Brasil', terminalCaptado: 'ECOPORTO' }),
    ]);
    render(<HistoricoPage />);

    expect(await screen.findByText('LOGMAIS')).toBeInTheDocument();
    expect(screen.getByText(/santos brasil/i)).toBeInTheDocument();
    expect(screen.getByText(/ECOPORTO/)).toBeInTheDocument();
  });

  it('clicar em "Registrado em" inverte mais recente ↔ mais antigo primeiro (pedido 17/09/2026)', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([
      base({ id: 1, cli: 'ANTIGA', createdAt: '2026-09-01T00:00:00.000Z' }),
      base({ id: 2, cli: 'RECENTE', createdAt: '2026-09-10T00:00:00.000Z' }),
    ]);
    render(<HistoricoPage />);
    await screen.findByText('RECENTE');

    const linhasIniciais = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(linhasIniciais[0]).toContain('RECENTE'); // padrão: mais recente primeiro

    await user.click(screen.getByRole('columnheader', { name: /Registrado em/ }));

    const linhasInvertidas = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(linhasInvertidas[0]).toContain('ANTIGA'); // depois de clicar: mais antigo primeiro
  });

  it('dá pra ordenar por ETA também, não só por Registrado em (pedido 17/09/2026)', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce([
      base({ id: 1, cli: 'ETA-DISTANTE', eta: '2026-12-31', createdAt: '2026-09-05T00:00:00.000Z' }),
      base({ id: 2, cli: 'ETA-PROXIMA', eta: '2026-09-20', createdAt: '2026-09-01T00:00:00.000Z' }),
    ]);
    render(<HistoricoPage />);
    await screen.findByText('ETA-DISTANTE');

    await user.click(screen.getByRole('columnheader', { name: /^ETA/ }));

    // 1º clique na coluna ETA: mais recente/distante primeiro (padrão de toda troca de coluna)
    let linhas = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(linhas[0]).toContain('ETA-DISTANTE');

    await user.click(screen.getByRole('columnheader', { name: /^ETA/ }));

    // 2º clique: inverte — ETA mais próxima primeiro
    linhas = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(linhas[0]).toContain('ETA-PROXIMA');
  });
});
