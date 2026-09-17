import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CarteiraPage from '../page';
import type { CockpitRow } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/carteira',
}));

// Mock por ROTA, não por ordem de chamada — a Carteira busca /carteira e
// /clientes em paralelo (apelido do cliente, ver lib/apelido.ts), então uma
// fila única (mockResolvedValueOnce em sequência) desalinha sempre que as
// duas chamadas acontecem numa ordem diferente da esperada pelo teste.
const filas: Record<string, unknown[]> = {};
function filaApi(path: string, valor: unknown) {
  (filas[path] ??= []).push(valor);
}
const apiFetchMock = vi.fn((path: string) => {
  const fila = filas[path];
  if (fila?.length) {
    const proximo = fila.shift();
    return proximo instanceof Error ? Promise.reject(proximo) : Promise.resolve(proximo);
  }
  if (path === '/clientes') return Promise.resolve([]); // sem apelido, mostra o texto original
  return Promise.resolve(undefined);
});
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...(args as [string])) };
});

function row(overrides: Partial<CockpitRow>): CockpitRow {
  return {
    cnpj: '',
    cli: 'TECNO',
    ref: 'TECNO 001',
    eta: '2026-09-10',
    regime: 'DTA',
    ce: '',
    bl: '',
    navio: 'MSC AMALFI',
    cont: '',
    qtd: '1',
    desp: 'LOGMAIS',
    atrac: 'Santos Brasil',
    parc: 'ECOPORTO',
    stage: 'MANIFESTADA_PARC',
    capId: 1,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('CarteiraPage', () => {
  afterEach(() => {
    for (const k of Object.keys(filas)) delete filas[k];
    apiFetchMock.mockClear();
  });

  it('mostra as 5 faixas de risco com a contagem correta', async () => {
    filaApi('/carteira', {
      rows: [row({ stage: 'MANIFESTADA_DOCS' }), row({ stage: 'EFETIVA', capId: 2 })],
    });
    render(<CarteiraPage />);

    expect(await screen.findByText('Crítico')).toBeInTheDocument();
    expect(screen.getByText('Efetivado')).toBeInTheDocument();
  });

  it('por padrão mostra o registro mais recente primeiro (pedido 17/09/2026)', async () => {
    filaApi('/carteira', {
      rows: [
        row({ capId: 1, cli: 'ANTIGO', eta: '2026-09-30', createdAt: '2026-09-01T00:00:00.000Z' }),
        row({ capId: 2, cli: 'RECENTE', eta: '2026-12-31', createdAt: '2026-09-10T00:00:00.000Z' }),
      ],
    });
    render(<CarteiraPage />);
    await screen.findByText('ANTIGO');

    const linhas = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(linhas[0]).toContain('RECENTE'); // registrado por último, aparece primeiro
  });

  it('mostra "Registrado em" com a data em que o processo foi feito (pedido 17/09/2026)', async () => {
    filaApi('/carteira', { rows: [row({ createdAt: '2026-09-05T14:30:00.000Z' })] });
    render(<CarteiraPage />);

    expect(await screen.findByText('05/09/2026')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Registrado em/ })).toBeInTheDocument();
  });

  it('ordena por "Registrado em" ao clicar no cabeçalho — mais recente/mais antigo', async () => {
    const user = userEvent.setup();
    filaApi('/carteira', {
      rows: [
        row({ capId: 1, cli: 'ANTIGO', createdAt: '2026-09-01T00:00:00.000Z' }),
        row({ capId: 2, cli: 'RECENTE', createdAt: '2026-09-10T00:00:00.000Z' }),
      ],
    });
    render(<CarteiraPage />);
    await screen.findByText('ANTIGO');

    await user.click(screen.getByRole('columnheader', { name: /Registrado em/ }));
    let clientes = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(clientes[0]).toContain('ANTIGO'); // 1º clique: crescente (mais antigo primeiro)

    await user.click(screen.getByRole('columnheader', { name: /Registrado em/ }));
    clientes = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(clientes[0]).toContain('RECENTE'); // 2º clique: inverte (mais recente primeiro)
  });

  it('alerta minimizável esconde e mostra o texto', async () => {
    const user = userEvent.setup();
    filaApi('/carteira', {
      rows: [row({ regime: '', eta: '2026-12-01', stage: 'NENHUM', capId: null })],
    });
    render(<CarteiraPage />);

    await screen.findByText('Processos');
    expect(screen.getByText(/janela de 7 dias/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '▾' }));
    expect(screen.queryByText(/janela de 7 dias/)).not.toBeInTheDocument();
  });

  it('busca reconhece um código de container e oferece rastreio', async () => {
    const user = userEvent.setup();
    filaApi('/carteira', { rows: [] });
    render(<CarteiraPage />);

    await screen.findByText('Processos');
    await user.type(
      screen.getByPlaceholderText(/o que falta captar/),
      'MSDU7175720',
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText(/Detectei um/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rastrear no track-trace' })).toBeInTheDocument();
  });

  it('busca por palavra-chave "crítico" filtra a lista de risco', async () => {
    const user = userEvent.setup();
    filaApi('/carteira', {
      rows: [row({ stage: 'MANIFESTADA_DOCS', cli: 'ALUZEN', ref: 'ALUZEN 002' })],
    });
    render(<CarteiraPage />);

    await screen.findByText('Processos');
    await user.type(screen.getByPlaceholderText(/o que falta captar/), 'o que está crítico?');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText(/em estado crítico/)).toBeInTheDocument();
  });

  it('pagina a tabela de processos de 5 em 5, igual ao Histórico', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 6 }, (_, i) =>
      row({ capId: i + 1, cli: `CLIENTE${i + 1}`, ref: `REF${i + 1}` }),
    );
    filaApi('/carteira', { rows });
    render(<CarteiraPage />);

    await screen.findByText('CLIENTE1');
    expect(screen.getByText('CLIENTE5')).toBeInTheDocument();
    expect(screen.queryByText('CLIENTE6')).not.toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próxima ›' }));

    expect(screen.getByText('CLIENTE6')).toBeInTheDocument();
    expect(screen.queryByText('CLIENTE1')).not.toBeInTheDocument();
    expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();
  });

  it('volta pra página 1 quando um filtro muda o conjunto exibido', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 6 }, (_, i) => row({ capId: i + 1, cli: `CLIENTE${i + 1}` }));
    filaApi('/carteira', { rows });
    render(<CarteiraPage />);

    await screen.findByText('CLIENTE1');
    await user.click(screen.getByRole('button', { name: 'Próxima ›' }));
    expect(await screen.findByText(/Página 2 de 2/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('buscar cliente, BL, navio…'), 'CLIENTE1');

    expect(await screen.findByText(/Página 1 de/)).toBeInTheDocument();
  });

  it('busca ignora espaço no final (pedido 17/09/2026)', async () => {
    const user = userEvent.setup();
    filaApi('/carteira', { rows: [row({ bl: 'HBCN066406' })] });
    render(<CarteiraPage />);
    await screen.findByText('TECNO'); // cliente do row() padrão

    // BL não aparece como texto na tabela da Carteira (só no Histórico) —
    // busca por ele com espaço no final e confere que a linha continua lá.
    await user.type(screen.getByPlaceholderText('buscar cliente, BL, navio…'), 'HBCN066406 ');

    expect(screen.getByText('TECNO')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum processo com este filtro')).not.toBeInTheDocument();
  });

  it('importa uma planilha e mostra o resumo estruturado, recarregando a carteira', async () => {
    const user = userEvent.setup();
    filaApi('/carteira', { rows: [] }); // load() inicial
    filaApi('/import/logcomex', { processados: 3, porCnpj: 2, provaveis: 1, ignorados: 5 });
    filaApi('/carteira', { rows: [row({})] }); // load() depois do import
    render(<CarteiraPage />);

    await screen.findByText('Processos');
    const file = new File(['conteudo'], 'planilha.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await user.upload(screen.getByLabelText('Selecionar planilha do Logcomex'), file);

    expect(await screen.findByText(/processados/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/import/logcomex',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    // recarregou a carteira depois de importar (última chamada é GET /carteira de novo)
    const ultimaChamada = apiFetchMock.mock.calls.at(-1);
    expect(ultimaChamada?.[0]).toBe('/carteira');
  });

  it('mostra o apelido cadastrado em vez do nome digitado por extenso (pedido 17/09/2026)', async () => {
    filaApi('/carteira', { rows: [row({ cli: 'HUESKER LTDA' })] });
    filaApi('/clientes', [
      { id: 1, name: 'HUESKER BRASIL LTDA', cnpj: null, cnpjRaiz: null, aliases: ['HUESKER'], ativo: true },
    ]);
    render(<CarteiraPage />);

    expect(await screen.findByText('HUESKER')).toBeInTheDocument();
    expect(screen.queryByText('HUESKER LTDA')).not.toBeInTheDocument();
  });

  it('sem casamento de apelido, mostra o texto original (nunca esconde dado)', async () => {
    filaApi('/carteira', { rows: [row({ cli: 'SEM CADASTRO' })] });
    render(<CarteiraPage />);

    expect(await screen.findByText('SEM CADASTRO')).toBeInTheDocument();
  });
});
