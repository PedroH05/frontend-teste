import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CaptacoesPage from '../page';
import { mockCaptacoes } from '@/lib/mock-data';

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

// Popover do @base-ui trava ~45s no jsdom ao abrir (cálculo de posição sem
// layout real) — aqui vira um abre/fecha simples; o que se testa é o
// DateField (escolher dia, salvar ISO), não o posicionamento.
vi.mock('@/components/ui/popover', async () => {
  const React = await import('react');
  type Ctx = { open: boolean; setOpen: (o: boolean) => void };
  const PopoverCtx = React.createContext<Ctx>({ open: false, setOpen: () => {} });
  function Popover({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    children: React.ReactNode;
  }) {
    return <PopoverCtx.Provider value={{ open, setOpen: onOpenChange }}>{children}</PopoverCtx.Provider>;
  }
  function PopoverTrigger({
    render,
    children,
    ...props
  }: {
    render: React.ReactElement<Record<string, unknown>>;
    children: React.ReactNode;
  }) {
    const { open, setOpen } = React.useContext(PopoverCtx);
    return React.cloneElement(render, { ...props, onClick: () => setOpen(!open) }, children);
  }
  function PopoverContent({ children }: { children: React.ReactNode }) {
    const { open } = React.useContext(PopoverCtx);
    return open ? <div data-slot="popover-content">{children}</div> : null;
  }
  return { Popover, PopoverTrigger, PopoverContent };
});

const PROXIMO = { name: 'Próximo' } as const;

// Botão da etapa no stepper (não o "Editar X" da Ficha completa).
function etapa(nome: string) {
  const nav = screen.getByRole('navigation', { name: 'Etapas' });
  return within(nav).getByRole('button', { name: new RegExp(nome) });
}
function estadoDa(nome: string) {
  return etapa(nome).querySelector('[data-estado]')?.getAttribute('data-estado');
}

// Dia 15 do mês que o calendário abre (o atual, sem data escolhida) — não
// depende do relógio da máquina que roda o teste.
function dia15DoMesAtual() {
  const hoje = new Date();
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), 15);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
  return { iso, br: d.toLocaleDateString('pt-BR') };
}

async function escolherDia15(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByLabelText(label));
  const { iso } = dia15DoMesAtual();
  const botaoDia = document.querySelector(`td[data-day="${iso}"] button`);
  if (!botaoDia) throw new Error('calendário não abriu');
  // fireEvent, não user.click: o foco do userEvent faz o react-day-picker
  // re-renderizar o dia antes do clique chegar, e o clique se perde.
  fireEvent.click(botaoDia as HTMLElement);
  await waitFor(() => expect(screen.getByLabelText(label)).not.toHaveTextContent('Selecionar data'));
}

describe('CaptacoesPage', () => {
  afterEach(() => {
    for (const k of Object.keys(filas)) delete filas[k];
    apiFetchMock.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it('bloqueia salvar sem cliente e volta pro passo 1', async () => {
    const user = userEvent.setup();
    render(<CaptacoesPage />);

    // navega até o último passo (Revisão) sem preencher nada — 6 passos pra
    // chegar nela, agora que Carregamento (6º) entrou antes dela (01/10/2026)
    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByRole('button', PROXIMO));
    }
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // erro aparece junto do campo e o stepper volta pra etapa 1 — ver
    // goToStep(0) em handleSubmit.
    expect(await screen.findByText('Campo obrigatório')).toBeInTheDocument();
    expect(etapa('Identificação')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByLabelText(/Cliente/)).toHaveAttribute('aria-invalid', 'true');
    expect(apiFetchMock).not.toHaveBeenCalledWith('/captacoes', expect.anything());
  });

  it('salva e navega pro histórico, aplicando efetivada a partir do status', async () => {
    const user = userEvent.setup();
    filaApi('/captacoes', {});
    render(<CaptacoesPage />);

    await user.type(screen.getByLabelText('Cliente'), 'tecno');

    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByRole('button', PROXIMO));
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

  it('passo Carregamento (6º) salva datas (pelo calendário) e transportadora (pedido 01/10/2026)', async () => {
    const user = userEvent.setup();
    filaApi('/captacoes', {});
    render(<CaptacoesPage />);

    await user.type(screen.getByLabelText('Cliente'), 'tecno');
    await user.click(etapa('Carregamento'));

    // tudo vazio — aviso de que dá pra completar depois
    expect(screen.getByText('Dá pra salvar e completar depois.')).toBeInTheDocument();

    await escolherDia15(user, 'Data de carregamento');
    await user.type(screen.getByLabelText('Transportadora'), 'RODOMAX');
    await escolherDia15(user, 'Data de chegada (destino)');
    expect(screen.queryByText('Dá pra salvar e completar depois.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', PROXIMO));

    // Revisão: Carregamento completo na Ficha
    const { iso, br } = dia15DoMesAtual();
    expect(screen.getByRole('heading', { name: 'Carregamento' })).toBeInTheDocument();
    expect(screen.getAllByText(br)).toHaveLength(2);
    expect(screen.getByText('RODOMAX')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    const chamadaSalvar = apiFetchMock.mock.calls.find((c) => c[0] === '/captacoes' && c[1]);
    const body = JSON.parse((chamadaSalvar as [string, { body: string }])[1].body);
    expect(body.dataCarregamento).toBe(iso);
    expect(body.transportadora).toBe('RODOMAX');
    expect(body.dataChegadaDestino).toBe(iso);
  });

  it('passo Terminal (4º) não tem mais Data de chegada — só existe no Carregamento (pedido 08/10/2026)', async () => {
    const user = userEvent.setup();
    render(<CaptacoesPage />);

    await user.type(screen.getByLabelText('Cliente'), 'tecno');
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', PROXIMO));
    }
    // passo 3 = Terminal
    expect(screen.queryByLabelText('Data de chegada')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Atracação')).toBeInTheDocument();
  });

  it('Enter num campo avança pra próxima etapa, sem precisar clicar em Próximo (pedido 16/09/2026)', async () => {
    const user = userEvent.setup();
    render(<CaptacoesPage />);

    expect(screen.getByLabelText('Cliente')).toBeInTheDocument(); // passo 1 (Identificação)
    await user.type(screen.getByLabelText('Cliente'), 'tecno{Enter}');

    expect(await screen.findByLabelText('ETA')).toBeInTheDocument(); // passo 2 (Carga)
    expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument();
  });

  it('estado da etapa vem só dos dados: âmbar com "N campos vazios" ou verde quando completa (HANDOFF seção 4)', async () => {
    const user = userEvent.setup();
    render(<CaptacoesPage />);

    // nada visitado ainda e já mostra o que falta — não depende de posição
    expect(estadoDa('Identificação')).toBe('atual');
    expect(estadoDa('Carga')).toBe('vazios');
    expect(etapa('Carga')).toHaveTextContent('4 campos vazios');
    expect(estadoDa('Revisão')).toBe('pendente'); // não nasce verde

    // só "Cliente" preenchido dos 3 campos da etapa 1 (cnpj, cli, referencia)
    await user.type(screen.getByLabelText('Cliente'), 'TECNO');
    await user.click(screen.getByRole('button', PROXIMO));
    expect(estadoDa('Identificação')).toBe('vazios');
    expect(etapa('Identificação')).toHaveTextContent('2 campos vazios');

    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    await user.type(screen.getByLabelText('Referência'), 'REF001');
    await user.type(screen.getByLabelText('CNPJ do cliente'), '12.345.678/0001-99');
    await user.click(screen.getByRole('button', PROXIMO));

    expect(estadoDa('Identificação')).toBe('completa');
    expect(etapa('Identificação')).toHaveTextContent('TECNO'); // resumo do que foi preenchido
    expect(screen.getByText('1 de 6 etapas completas')).toBeInTheDocument();
  });

  it('contêineres viram etiquetas e a linha embaixo confere com a quantidade', async () => {
    const user = userEvent.setup();
    filaApi('/captacoes', {});
    render(<CaptacoesPage />);
    await user.type(screen.getByLabelText('Cliente'), 'tecno');
    await user.click(etapa('Carga'));

    await user.click(screen.getByRole('button', { name: 'Aumentar quantidade' }));
    await user.click(screen.getByRole('button', { name: 'Aumentar quantidade' }));
    expect(screen.getByLabelText('Qtde de contêineres')).toHaveValue(2);

    // Enter com texto vira etiqueta (não avança de etapa); hífen faz parte do código
    await user.type(screen.getByLabelText('Contêineres'), 'MSCU452849-8{Enter}');
    expect(screen.getByLabelText('ETA')).toBeInTheDocument();
    expect(screen.getByText('1 contêiner informado — a quantidade diz 2')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Contêineres'), 'TCLU9981023,');
    expect(screen.getByText('2 contêineres informados — bate com a quantidade')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remover MSCU452849-8' }));
    expect(screen.queryByText('MSCU452849-8')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Diminuir quantidade' }));
    expect(screen.getByText('1 contêiner informado — bate com a quantidade')).toBeInTheDocument();

    await user.click(etapa('Revisão'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    const chamadaSalvar = apiFetchMock.mock.calls.find((c) => c[0] === '/captacoes' && c[1]);
    const body = JSON.parse((chamadaSalvar as [string, { body: string }])[1].body);
    expect(body.container).toBe('TCLU9981023');
    expect(body.quantidade).toBe(1);
  });

  it('Revisão lista o que ficou vazio e "Preencher" leva pra etapa', async () => {
    const user = userEvent.setup();
    useSearchParamsMock.mockReturnValue(new URLSearchParams({ cli: 'TECNO', step: '6' }));
    render(<CaptacoesPage />);

    expect(screen.getByText('6 etapas com campos vazios')).toBeInTheDocument();
    expect(screen.getByText('Dá pra salvar assim e completar depois.')).toBeInTheDocument();
    expect(screen.getByText('CNPJ, Referência')).toBeInTheDocument();
    expect(screen.getByText('1 de 21 campos preenchidos')).toBeInTheDocument();
    expect(screen.getAllByText('Vazio').length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('button', { name: 'Preencher' })[1]); // 2 · Carga
    expect(etapa('Carga')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByLabelText('Navio')).toBeInTheDocument();
  });

  it('Excluir pede confirmação no AlertDialog antes de apagar', async () => {
    const user = userEvent.setup();
    const captacaoId = mockCaptacoes[0].id;
    useSearchParamsMock.mockReturnValue(new URLSearchParams({ edit: String(captacaoId) }));
    filaApi('/captacoes', [mockCaptacoes[0]]);
    render(<CaptacoesPage />);

    await user.click(await screen.findByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('Excluir este processo?')).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalledWith(`/captacoes/${captacaoId}`, expect.anything());

    await user.click(screen.getByRole('button', { name: 'Excluir processo' }));
    expect(apiFetchMock).toHaveBeenCalledWith(`/captacoes/${captacaoId}`, { method: 'DELETE' });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/historico'));
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
    await user.click(screen.getByRole('button', PROXIMO));
    await user.click(screen.getByRole('button', PROXIMO));

    expect(screen.getByRole('combobox', { name: 'Despachante' })).toHaveTextContent('NIRRON');
    expect(screen.queryByPlaceholderText('Nome do despachante')).not.toBeInTheDocument();
  });

  it('despachante fora da lista padrão aparece no campo de texto livre ("+ novo despachante")', async () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams({ cli: 'TECNO', despachante: 'NOVOLOG' }));
    const user = userEvent.setup();
    render(<CaptacoesPage />);
    await user.click(screen.getByRole('button', PROXIMO));
    await user.click(screen.getByRole('button', PROXIMO));

    expect(screen.getByPlaceholderText('Nome do despachante')).toHaveValue('NOVOLOG');
  });

  it('painel de Notas: cria uma nota, dá nome e salva (pedido 08/10/2026)', async () => {
    const user = userEvent.setup();
    const captacaoId = mockCaptacoes[0].id;
    useSearchParamsMock.mockReturnValue(new URLSearchParams({ edit: String(captacaoId) }));
    filaApi('/captacoes', [mockCaptacoes[0]]);
    filaApi(`/captacoes/${captacaoId}/notas`, []);
    render(<CaptacoesPage />);

    const btnNotas = await screen.findByRole('button', { name: /^Notas/ });
    await user.click(btnNotas);
    expect(await screen.findByText('Nenhuma nota ainda.')).toBeInTheDocument();

    filaApi(`/captacoes/${captacaoId}/notas`, {
      id: 1,
      captacaoId,
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

    filaApi('/notas/1', { id: 1, captacaoId, titulo: 'Avaria', texto: 'detalhe', cor: null, fixada: false, createdAt: '', updatedAt: '' });
    await user.clear(campoTitulo);
    await user.type(campoTitulo, 'Avaria');
    await user.tab();

    const chamadaPatch = apiFetchMock.mock.calls.find((c) => c[0] === '/notas/1');
    expect(chamadaPatch).toBeTruthy();
  });
});
