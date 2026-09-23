'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { Captacao, CaptacaoInput, Cliente } from '@/lib/types';
import { cleanDesp, DESPACHANTES_PADRAO } from '@/lib/despachante';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Comportamento portado de captacao-valetrade/public/index.html
// (salvarManual, manualStep). Ver
// migration-plan/features/captacoes/CURRENT_BEHAVIOR.md e
// migration-plan/prompts/03-captacoes.md pra fórmula exata de
// stage/doc_*/doc_recebida_em (calculada no backend a partir de
// `efetivada` + `docBl`/`docCe`/`docPl`, não recalculada aqui).
const STEPS = ['Identificação', 'Carga', 'Aduana', 'Terminal', 'Situação', 'Revisão'] as const;

function fmtDateBR(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

// Item da revisão — "não informado" em itálico cinza quando vazio, pra
// ficar óbvio o que falta sem precisar decorar o formulário.
function RecapItem({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-[9.5px] font-bold tracking-[.04em] uppercase" style={{ color: 'var(--vt-muted2)' }}>
        {label}
      </div>
      <div
        className="text-[12.5px] font-semibold"
        style={value ? { color: 'var(--vt-ink)' } : { color: 'var(--vt-muted2)', fontStyle: 'italic', fontWeight: 500 }}
      >
        {value || 'não informado'}
      </div>
    </div>
  );
}

function RecapSection({
  n,
  title,
  onEdit,
  children,
}: {
  n: number;
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="vt-glass p-[14px_16px]">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-extrabold text-white"
          style={{ background: 'var(--vt-c-efet)' }}
        >
          {n}
        </span>
        <h3 className="flex-1 text-[12.5px] font-extrabold">{title}</h3>
        <button type="button" onClick={onEdit} className="text-[10.5px] font-bold" style={{ color: 'var(--vt-red)' }}>
          Editar
        </button>
      </div>
      {children}
    </div>
  );
}

// Quão preenchida está uma etapa já visitada — pedido 17/09/2026: a
// bolinha ficava verde só por ter sido visitada, mesmo vazia. `boolean`
// conta como preenchido só quando `true` (ex.: doc recebido marcado).
function contarPreenchidos(campos: unknown[]): { preenchidos: number; total: number } {
  const preenchidos = campos.filter((v) => {
    if (typeof v === 'boolean') return v;
    return v !== undefined && v !== null && String(v).trim() !== '';
  }).length;
  return { preenchidos, total: campos.length };
}

const REGIMES = ['DTA', 'DUIMP', 'DI', 'DAC', 'AGUARDANDO'];
const ATRACACOES = ['Santos Brasil', 'BTP', 'DPW', 'ECOPORTO'];
const PARCEIROS = ['ECOPORTO', 'MOVECTA', 'DPW'];

type FormState = CaptacaoInput & { publicaConfirmado?: boolean };

const initialForm: FormState = {};

// Cores de "contêiner" sorteadas pro botão Salvar virar ao animar — portado
// de CONTAINER_COLORS no index.html original.
const CONTAINER_COLORS: [string, string][] = [
  ['#4FA8C9', '#3A7A96'],
  ['#D9A828', '#B08419'],
  ['#2C8C5A', '#1F6640'],
  ['#E0762E', '#B85A1E'],
  ['#2E4C7A', '#203657'],
  ['#C0392B', '#96271C'],
];

export default function CaptacoesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[13px]" style={{ color: 'var(--vt-muted)' }}>Carregando…</div>}>
      <CaptacoesForm />
    </Suspense>
  );
}

function CaptacoesForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  // Carteira e Histórico levam direto pra Revisão (?step=5) ao clicar num
  // processo — pedido 23/09/2026, pra reaproveitar esta tela como o "ver
  // detalhes" das duas, no lugar de um drawer à parte.
  const initialStep = (() => {
    const raw = Number(searchParams.get('step'));
    return Number.isInteger(raw) && raw >= 0 && raw < STEPS.length ? raw : 0;
  })();
  const [step, setStep] = useState(initialStep);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([initialStep]));

  function goToStep(i: number) {
    setStep(i);
    setVisited((v) => new Set(v).add(i));
  }
  // Pré-preenchimento a partir da Carteira (captar()): mesmos campos que o
  // original levava do embarque pro formulário. Só usado quando não é edição.
  const [form, setForm] = useState<FormState>(() => {
    if (editId) return initialForm;
    const pick = (k: string) => searchParams.get(k) || undefined;
    const prefill: FormState = {
      cli: pick('cli'),
      referencia: pick('referencia'),
      eta: pick('eta'),
      navio: pick('navio'),
      ce: pick('ce'),
      bl: pick('bl'),
      container: pick('container'),
      regime: pick('regime'),
      despachante: pick('despachante'),
      terminalDescarga: pick('terminalDescarga'),
      terminalCaptado: pick('terminalCaptado'),
      cnpj: pick('cnpj'),
    };
    return Object.values(prefill).some(Boolean) ? prefill : initialForm;
  });
  const [status, setStatus] = useState<'PENDENTE' | 'EFETIVA'>('PENDENTE');
  // Instantâneo do formulário assim que ele fica pronto pra edição — pra
  // saber se algo mudou (ver isDirty/aviso de saída abaixo). Fica `null`
  // (não compara nada ainda) enquanto uma edição existente está carregando.
  const [baseline, setBaseline] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const truckRef = useRef<SVGSVGElement>(null);
  const bedRef = useRef<SVGRectElement>(null);

  // Mede a posição real da "caçamba" do caminhão (bedRef) contra o botão
  // Salvar, pra o contêiner cair no lugar certo em vez de um valor de queda
  // fixo — portado de shipButtonAway() no index.html original.
  function shipButtonAway(): Promise<void> {
    return new Promise((resolve) => {
      const wrap = wrapRef.current;
      const btn = btnRef.current;
      const truck = truckRef.current;
      const bed = bedRef.current;
      if (wrap && btn && truck && bed) {
        const prevTransform = truck.style.transform;
        const prevOpacity = truck.style.opacity;
        truck.style.transform = 'translateY(0) scale(.92)';
        truck.style.opacity = '1';
        const btnRect = btn.getBoundingClientRect();
        const bedRect = bed.getBoundingClientRect();
        truck.style.transform = prevTransform;
        truck.style.opacity = prevOpacity;
        const dx = bedRect.left + bedRect.width / 2 - (btnRect.left + btnRect.width / 2);
        const dy = bedRect.top + bedRect.height / 2 - (btnRect.top + btnRect.height / 2);
        const [cBase, cShade] = CONTAINER_COLORS[Math.floor(Math.random() * CONTAINER_COLORS.length)];
        wrap.style.setProperty('--cBase', cBase);
        wrap.style.setProperty('--cShade', cShade);
        wrap.style.setProperty('--fallX', `${dx}px`);
        wrap.style.setProperty('--fallY', `${dy}px`);
        wrap.classList.add('vt-shipping');
      }
      setTimeout(resolve, 1400);
    });
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'cli' && error === 'Informe ao menos o cliente.') setError('');
  }

  // Instantâneo pra uma captação nova — pra edição, o efeito abaixo faz
  // isso de novo assim que o dado real chegar (aqui `form`/`status` ainda
  // são o placeholder vazio de antes de carregar).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- só na montagem, captura o valor inicial (prefill ou vazio)
    if (!editId) setBaseline(JSON.stringify({ form, status }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem, de propósito
  }, []);

  // Modo edição: carrega a captação existente e preenche o formulário.
  // Não existe GET /captacoes/:id — busca a lista e acha pelo id, mesmo
  // padrão do original (editProcess() achava no array DATA já carregado).
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const rows = await apiFetch<Captacao[]>('/captacoes');
        const c = rows.find((r) => r.id === Number(editId));
        if (!c) {
          setError('Captação não encontrada.');
          return;
        }
        const loadedForm: FormState = {
          cli: c.cli ?? '',
          referencia: c.referencia ?? '',
          eta: c.eta ? c.eta.slice(0, 10) : undefined,
          navio: c.navio ?? '',
          quantidade: c.quantidade ?? undefined,
          container: c.container ?? '',
          ce: c.ce ?? '',
          regime: c.regime ?? undefined,
          bl: c.bl ?? '',
          despachante: c.despachante ?? '',
          terminalDescarga: c.terminalDescarga ?? undefined,
          terminalCaptado: c.terminalCaptado ?? undefined,
          observacao: c.observacao ?? '',
          cnpj: c.cnpj ?? '',
          docBl: c.docBl ?? false,
          docCe: c.docCe ?? false,
          docPl: c.docPl ?? false,
          prejuizoPublico: c.prejuizoPublico ?? false,
        };
        const loadedStatus = c.stage === 'EFETIVA' ? 'EFETIVA' : 'PENDENTE';
        setForm(loadedForm);
        setStatus(loadedStatus);
        setBaseline(JSON.stringify({ form: loadedForm, status: loadedStatus }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar captação');
      } finally {
        setLoadingEdit(false);
      }
    })();
  }, [editId]);

  // Clientes cadastrados — só pra sugerir nome e pré-preencher CNPJ ao
  // selecionar (pedido 22/09/2026); busca própria, silenciosa (falha não
  // trava a tela, cliente continua digitável livremente).
  const [clientes, setClientes] = useState<Cliente[]>([]);
  useEffect(() => {
    let active = true;
    apiFetch<Cliente[]>('/clientes')
      .then((data) => {
        if (active) setClientes(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [sugestaoAberta, setSugestaoAberta] = useState(false);
  const sugestoesCliente = useMemo(() => {
    const q = (form.cli ?? '').trim().toLowerCase();
    if (!q) return [];
    return clientes
      .filter(
        (c) => c.name.toLowerCase().includes(q) || c.aliases.some((a) => a.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [clientes, form.cli]);

  function selecionarCliente(c: Cliente) {
    setForm((f) => ({ ...f, cli: c.aliases[0] || c.name, cnpj: c.cnpj || f.cnpj }));
    setSugestaoAberta(false);
  }

  // Despachante: select com as 4 opções do sistema antigo (`DESPACHANTES_PADRAO`)
  // + "+ novo despachante" pra qualquer outro nome — campo de texto livre foi
  // regressão da migração, ver `lib/despachante.ts`. `despachanteEhCustom`
  // recalcula a cada render (cobre o valor chegar depois, no modo edição, sem
  // precisar de efeito); `mostrarDespCustom` só guarda o clique explícito em
  // "+ novo despachante" antes de haver texto digitado.
  const despachanteEhCustom = !!form.despachante && !DESPACHANTES_PADRAO.includes(form.despachante);
  const [mostrarDespCustom, setMostrarDespCustom] = useState(false);
  const exibirDespCustom = mostrarDespCustom || despachanteEhCustom;

  const isDirty = baseline !== null && JSON.stringify({ form, status }) !== baseline;

  // Aviso antes de sair com dado digitado e não salvo — pedido 17/09/2026:
  // clicar sem querer num item do menu (ou fechar/atualizar a aba) descartava
  // tudo sem perguntar nada. Duas partes:
  //  · beforeunload cobre fechar a aba, atualizar (F5) ou digitar outra URL —
  //    é o único jeito de interceptar isso, e o texto do aviso é do próprio
  //    navegador, não dá pra customizar.
  //  · clique em captura no documento cobre navegação interna (Link da
  //    barra lateral) — o Next troca de tela sem "descarregar" a página,
  //    então beforeunload sozinho não pega esse caso.
  // Não cobre voltar/avançar pelo navegador (sem clique nem descarregar a
  // página pra interceptar) — limitação conhecida.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    function handleLinkClick(e: MouseEvent) {
      if (!isDirty) return;
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const destino = new URL(anchor.href, window.location.origin);
      if (destino.pathname === pathname) return; // mesma página — sem risco
      if (!window.confirm('Você tem dados digitados nesta captação que ainda não foram salvos. Sair mesmo assim?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleLinkClick, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [isDirty, pathname]);

  // Enter num campo de texto avança pra próxima etapa (ou salva, na última
  // com campo) — antes só dava pra avançar clicando em "Próximo". Só reage
  // em <input> mesmo: dentro do Select (é um <button> disparando o menu),
  // Enter continua escolhendo a opção normalmente, sem interferir.
  function handleStepKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return;
    if ((e.target as HTMLElement).tagName !== 'INPUT') return;
    e.preventDefault();
    if (step < STEPS.length - 1) goToStep(step + 1);
    else handleSubmit();
  }

  function handlePublicaChange(checked: boolean) {
    if (checked && !confirm('Confirma marcar esta carga como tabela pública?')) return;
    set('prejuizoPublico', checked);
  }

  async function handleSubmit() {
    setError('');
    if (!form.cli?.trim()) {
      setError('Informe ao menos o cliente.');
      goToStep(0);
      return;
    }
    setSaving(true);
    const shipDone = shipButtonAway();
    try {
      const payload: CaptacaoInput = {
        ...form,
        cli: form.cli.trim().toUpperCase(),
        referencia: form.referencia?.trim() || form.cli.trim().toUpperCase(),
        navio: form.navio?.trim().toUpperCase(),
        despachante: form.despachante ? cleanDesp(form.despachante) : undefined,
        efetivada: status === 'EFETIVA',
      };
      if (editId) {
        await apiFetch<CaptacaoInput>(`/captacoes/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<CaptacaoInput>('/captacoes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setBaseline(JSON.stringify({ form, status })); // salvou — não é mais "sujo"
      await shipDone;
      router.push('/historico');
    } catch (err) {
      wrapRef.current?.classList.remove('vt-shipping');
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar captação');
    } finally {
      setSaving(false);
    }
  }

  // Botão "Sair" — pedido 17/09/2026: não tinha jeito de sair sem salvar
  // além de clicar num item do menu (que já avisa se tem dado não salvo).
  // Não é um <a>, então não passa pelo guarda de clique em link — confirma
  // aqui do mesmo jeito.
  function handleExit() {
    if (isDirty && !confirm('Você tem dados digitados nesta captação que ainda não foram salvos. Sair mesmo assim?')) {
      return;
    }
    router.back();
  }

  async function handleDelete() {
    if (!editId) return;
    if (!confirm('Excluir este processo? Esta ação não pode ser desfeita.')) return;
    setSaving(true);
    try {
      await apiFetch(`/captacoes/${editId}`, { method: 'DELETE' });
      router.push('/historico');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
      setSaving(false);
    }
  }

  const showDocs = status !== 'EFETIVA';

  // 'todos' (verde) / 'parcial' (amarelo) / 'nenhum' (vermelho) — só chamado
  // pra etapas já visitadas (ver render do stepper). Revisão não tem campo
  // próprio pra editar, então conta como completa sempre que alcançada.
  function completudeStep(i: number): 'todos' | 'parcial' | 'nenhum' {
    const campos: unknown[] =
      i === 0
        ? [form.cnpj, form.cli, form.referencia]
        : i === 1
          ? [form.eta, form.navio, form.quantidade, form.container]
          : i === 2
            ? [form.ce, form.regime, form.bl, form.despachante]
            : i === 3
              ? [form.terminalDescarga, form.terminalCaptado]
              : i === 4
                ? showDocs
                  ? [form.observacao, form.docBl, form.docCe, form.docPl, form.prejuizoPublico]
                  : [form.observacao, form.prejuizoPublico]
                : [];
    if (campos.length === 0) return 'todos';
    const { preenchidos, total } = contarPreenchidos(campos);
    return preenchidos === total ? 'todos' : preenchidos === 0 ? 'nenhum' : 'parcial';
  }

  const glassBtn =
    'vt-glass-strong rounded-[11px] border border-[var(--vt-line)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--vt-ink)] shadow-[var(--vt-sh)] transition hover:-translate-y-px';
  const primaryBtn = 'vt-btn-primary rounded-[11px] px-3.5 py-2 text-[12.5px] font-semibold transition hover:-translate-y-px';

  if (loadingEdit) {
    return (
      <div className="p-8 text-[13px]" style={{ color: 'var(--vt-muted)' }}>Carregando captação…</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 sm:p-8" style={{ color: 'var(--vt-ink)' }}>
      <div>
        <h1 className="text-[21px] font-bold tracking-tight">
          {editId ? 'Editar captação' : 'Captação manual'}
        </h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--vt-muted)' }}>
          Os mesmos campos da planilha — agora salvos direto na captacao-api
        </p>
      </div>

      <div className="relative flex items-start pt-1">
        <div className="absolute top-[13px] right-0 left-0 h-[2px]" style={{ background: 'var(--vt-line)' }} />
        <div
          className="absolute top-[13px] left-0 h-[2px] transition-[width]"
          style={{
            // Acompanha a etapa atual, não a mais distante já visitada —
            // antes ficava parada no ponto mais longe mesmo voltando pra
            // uma etapa anterior. Pedido 17/09/2026.
            background: 'var(--vt-c-efet)',
            width: `${(step / (STEPS.length - 1)) * 100}%`,
          }}
        />
        {STEPS.map((label, i) => {
          const hasError = i === 0 && error === 'Informe ao menos o cliente.';
          const completude = visited.has(i) && i !== step ? completudeStep(i) : null;
          const state = hasError
            ? 'error'
            : i === step
              ? 'active'
              : completude === 'todos'
                ? 'done'
                : completude === 'parcial'
                  ? 'parcial'
                  : completude === 'nenhum'
                    ? 'nenhum'
                    : 'pending';
          return (
            <button
              key={label}
              type="button"
              onClick={() => goToStep(i)}
              className="relative z-10 flex flex-1 flex-col items-center gap-1.5"
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-extrabold"
                style={
                  state === 'done'
                    ? { background: 'var(--vt-c-efet)', borderColor: 'var(--vt-c-efet)', color: '#fff' }
                    : state === 'parcial'
                      ? { background: 'var(--vt-c-jan)', borderColor: 'var(--vt-c-jan)', color: '#fff' }
                      : state === 'nenhum'
                        ? { background: 'var(--vt-c-prej)', borderColor: 'var(--vt-c-prej)', color: '#fff' }
                        : state === 'active'
                          ? { background: 'var(--vt-red)', borderColor: 'var(--vt-red)', color: '#fff', boxShadow: '0 0 0 4px rgba(192,24,41,.15)' }
                          : state === 'error'
                            ? { background: '#fff', borderColor: 'var(--vt-red)', color: 'var(--vt-red)' }
                            : { background: '#fff', borderColor: 'var(--vt-line)', color: 'var(--vt-muted2)' }
                }
              >
                {state === 'done' ? '✓' : state === 'error' ? '!' : i + 1}
              </span>
              <span
                className="max-w-[70px] text-center text-[10px] leading-tight font-bold"
                style={{ color: state === 'active' || state === 'error' ? 'var(--vt-ink)' : 'var(--vt-muted)' }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="vt-glass p-[18px_20px]" onKeyDown={handleStepKeyDown}>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="cnpj">CNPJ do cliente</FieldLabel>
            <FieldContent>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={form.cnpj ?? ''}
                onChange={(e) => set('cnpj', e.target.value)}
              />
            </FieldContent>
          </Field>
          <Field className="relative">
            <FieldLabel htmlFor="cli">
              Cliente {error === 'Informe ao menos o cliente.' && <span style={{ color: 'var(--vt-c-prej)' }}>*</span>}
            </FieldLabel>
            <FieldContent>
              <Input
                id="cli"
                autoComplete="off"
                value={form.cli ?? ''}
                onChange={(e) => {
                  set('cli', e.target.value);
                  setSugestaoAberta(true);
                }}
                onFocus={() => setSugestaoAberta(true)}
                onBlur={() => setTimeout(() => setSugestaoAberta(false), 150)}
                style={error === 'Informe ao menos o cliente.' ? { borderColor: 'var(--vt-c-prej)', background: 'rgba(192,24,41,.04)' } : undefined}
              />
              {error === 'Informe ao menos o cliente.' && (
                <span className="text-[10.5px] font-semibold" style={{ color: 'var(--vt-c-prej)' }}>
                  Campo obrigatório
                </span>
              )}
              {sugestaoAberta && sugestoesCliente.length > 0 && (
                <ul
                  className="vt-glass-strong absolute top-full left-0 z-10 mt-1 w-full overflow-hidden rounded-[9px] border border-[var(--vt-line)] shadow-[var(--vt-sh)]"
                  role="listbox"
                >
                  {sugestoesCliente.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        className="w-full px-3 py-1.5 text-left text-[12px] font-semibold hover:bg-[color-mix(in_srgb,var(--vt-red)_8%,transparent)]"
                        style={{ color: 'var(--vt-ink)' }}
                        // onMouseDown (não onClick) dispara antes do onBlur do
                        // input, senão a lista some antes do clique registrar.
                        onMouseDown={() => selecionarCliente(c)}
                      >
                        {c.aliases[0] || c.name}
                        {c.cnpj && (
                          <span className="ml-1.5 font-normal" style={{ color: 'var(--vt-muted2)' }}>
                            {c.cnpj}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="referencia">Referência</FieldLabel>
            <FieldContent>
              <Input
                id="referencia"
                value={form.referencia ?? ''}
                onChange={(e) => set('referencia', e.target.value)}
              />
            </FieldContent>
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="eta">ETA</FieldLabel>
            <FieldContent>
              <Input
                id="eta"
                type="date"
                value={form.eta ?? ''}
                onChange={(e) => set('eta', e.target.value)}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="navio">Navio</FieldLabel>
            <FieldContent>
              <Input
                id="navio"
                value={form.navio ?? ''}
                onChange={(e) => set('navio', e.target.value)}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="quantidade">Qtde de contêineres</FieldLabel>
            <FieldContent>
              <Input
                id="quantidade"
                type="number"
                min={1}
                value={form.quantidade ?? ''}
                onChange={(e) => set('quantidade', e.target.value ? Number(e.target.value) : undefined)}
              />
            </FieldContent>
          </Field>
          <Field className="sm:col-span-3">
            <FieldLabel htmlFor="container">Container(s)</FieldLabel>
            <FieldContent>
              <Input
                id="container"
                placeholder="ex.: HLBU1763320 / FFAU5450940"
                value={form.container ?? ''}
                onChange={(e) => set('container', e.target.value)}
              />
            </FieldContent>
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="ce">CE Mercante</FieldLabel>
            <FieldContent>
              <Input id="ce" value={form.ce ?? ''} onChange={(e) => set('ce', e.target.value)} />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="regime">Regime aduaneiro</FieldLabel>
            <FieldContent>
              <Select value={form.regime} onValueChange={(v) => set('regime', v as string)}>
                <SelectTrigger id="regime">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {REGIMES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="bl">HBL</FieldLabel>
            <FieldContent>
              <Input
                id="bl"
                placeholder="ex.: HBCN066406"
                value={form.bl ?? ''}
                onChange={(e) => set('bl', e.target.value)}
              />
            </FieldContent>
          </Field>
          <Field className="sm:col-span-3">
            <FieldLabel htmlFor="despachante">Despachante</FieldLabel>
            <FieldContent>
              <Select
                value={exibirDespCustom ? '__new' : form.despachante || undefined}
                onValueChange={(v) => {
                  if (v === '__new') {
                    setMostrarDespCustom(true);
                    set('despachante', despachanteEhCustom ? form.despachante : '');
                  } else {
                    setMostrarDespCustom(false);
                    set('despachante', v as string);
                  }
                }}
              >
                <SelectTrigger id="despachante">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {DESPACHANTES_PADRAO.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new">+ novo despachante…</SelectItem>
                </SelectContent>
              </Select>
              {exibirDespCustom && (
                <Input
                  className="mt-1.5"
                  placeholder="Nome do despachante"
                  aria-label="Nome do novo despachante"
                  value={form.despachante ?? ''}
                  onChange={(e) => set('despachante', e.target.value)}
                />
              )}
            </FieldContent>
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="atrac">Atracação</FieldLabel>
            <FieldContent>
              <Select
                value={form.terminalDescarga}
                onValueChange={(v) => set('terminalDescarga', v as string)}
              >
                <SelectTrigger id="atrac">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ATRACACOES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="parc">Parceiro (captado)</FieldLabel>
            <FieldContent>
              <Select
                value={form.terminalCaptado}
                onValueChange={(v) => set('terminalCaptado', v as string)}
              >
                <SelectTrigger id="parc">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PARCEIROS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="status">Status da captação</FieldLabel>
              <FieldContent>
                <Select value={status} onValueChange={(v) => setStatus(v as 'PENDENTE' | 'EFETIVA')}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDENTE">Pendente de documentação</SelectItem>
                    <SelectItem value="EFETIVA">Captação efetivada no terminal</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="observacao">Observação</FieldLabel>
              <FieldContent>
                <Input
                  id="observacao"
                  value={form.observacao ?? ''}
                  onChange={(e) => set('observacao', e.target.value)}
                />
              </FieldContent>
            </Field>
          </div>

          {showDocs && (
            <div className="vt-glass space-y-2 p-4">
              <p className="text-[13px] font-bold">Documentos recebidos do cliente</p>
              <div className="flex gap-6">
                {(['docBl', 'docCe', 'docPl'] as const).map((key, i) => (
                  <label key={key} className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--vt-ink)' }}>
                    <Checkbox
                      checked={form[key] ?? false}
                      onCheckedChange={(c) => set(key, c === true)}
                    />
                    {['BL', 'CE', 'PL'][i]}
                  </label>
                ))}
              </div>
              <p className="text-[12px]" style={{ color: 'var(--vt-muted)' }}>
                {form.docBl && form.docCe && form.docPl
                  ? '⚠ Documentação completa recebida — precisa ser efetivada no terminal HOJE (crítico).'
                  : 'Marque o que já chegou. Documentação completa e ainda não efetivada = alerta de prejuízo.'}
              </p>
            </div>
          )}

          <div className="vt-glass p-4">
            <label className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--vt-ink)' }}>
              <Checkbox
                checked={form.prejuizoPublico ?? false}
                onCheckedChange={(c) => handlePublicaChange(c === true)}
              />
              Marcar como tabela pública
            </label>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--vt-muted)' }}>
              Use apenas quando o prejuízo desta carga entra na tabela pública.
            </p>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-2.5">
          <RecapSection n={1} title="Identificação" onEdit={() => goToStep(0)}>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
              <RecapItem label="CNPJ" value={form.cnpj} />
              <RecapItem label="Cliente" value={form.cli} />
              <RecapItem label="Referência" value={form.referencia} />
            </div>
          </RecapSection>

          <RecapSection n={2} title="Carga" onEdit={() => goToStep(1)}>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
              <RecapItem label="ETA" value={fmtDateBR(form.eta)} />
              <RecapItem label="Navio" value={form.navio} />
              <RecapItem label="Qtde" value={form.quantidade ? `${form.quantidade} contêineres` : undefined} />
              <div className="col-span-3">
                <RecapItem label="Container(s)" value={form.container} />
              </div>
            </div>
          </RecapSection>

          <RecapSection n={3} title="Aduana" onEdit={() => goToStep(2)}>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
              <RecapItem label="CE Mercante" value={form.ce} />
              <RecapItem label="Regime" value={form.regime} />
              <RecapItem label="HBL" value={form.bl} />
              <div className="col-span-3">
                <RecapItem label="Despachante" value={form.despachante} />
              </div>
            </div>
          </RecapSection>

          <RecapSection n={4} title="Terminal" onEdit={() => goToStep(3)}>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
              <RecapItem label="Atracação" value={form.terminalDescarga} />
              <RecapItem label="Parceiro" value={form.terminalCaptado} />
            </div>
          </RecapSection>

          <RecapSection n={5} title="Situação" onEdit={() => goToStep(4)}>
            <div className="mb-3.5 flex flex-wrap gap-x-7 gap-y-2.5">
              <div>
                <div className="text-[9.5px] font-bold tracking-[.04em] uppercase" style={{ color: 'var(--vt-muted2)' }}>Status</div>
                <span className={`vt-band ${status === 'EFETIVA' ? 'b-efet' : 'b-jan'}`}>
                  {status === 'EFETIVA' ? 'Captação efetivada no terminal' : 'Pendente de documentação'}
                </span>
              </div>
              <RecapItem label="Observação" value={form.observacao} />
              <RecapItem label="Tabela pública" value={form.prejuizoPublico ? 'Sim' : 'Não'} />
            </div>
            {showDocs && (
              <div>
                <div className="text-[9.5px] font-bold tracking-[.04em] uppercase" style={{ color: 'var(--vt-muted2)' }}>
                  Documentos recebidos
                </div>
                <div className="mt-1 flex gap-3.5">
                  {(['docBl', 'docCe', 'docPl'] as const).map((key, i) => (
                    <span key={key} className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                      <span
                        className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border text-[9px] text-white"
                        style={
                          form[key]
                            ? { background: 'var(--vt-c-efet)', borderColor: 'var(--vt-c-efet)' }
                            : { borderColor: 'var(--vt-line)' }
                        }
                      >
                        {form[key] ? '✓' : ''}
                      </span>
                      {['BL', 'CE', 'PL'][i]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </RecapSection>
        </div>
      )}

      </div>

      {error && error !== 'Informe ao menos o cliente.' && (
        <p className="text-[13px] font-semibold" style={{ color: 'var(--vt-c-prej)' }}>{error}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" className={glassBtn} onClick={handleExit}>
            Sair
          </Button>
          <Button variant="ghost" className={glassBtn} onClick={() => goToStep(Math.max(0, step - 1))} disabled={step === 0}>
            ‹ Anterior
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {editId && (
            <Button
              variant="ghost"
              className="rounded-[11px] px-3.5 py-2 text-[12.5px] font-semibold"
              style={{ color: 'var(--vt-c-prej)' }}
              onClick={handleDelete}
              disabled={saving}
            >
              Excluir
            </Button>
          )}
          {step < STEPS.length - 1 && (
            <Button variant="ghost" className={glassBtn} onClick={() => goToStep(Math.min(STEPS.length - 1, step + 1))}>
              Próximo ›
            </Button>
          )}
          <span ref={wrapRef} className="vt-save-wrap">
              <svg
                ref={truckRef}
                className="vt-save-truck"
                viewBox="0 0 64 30"
                width="60"
                height="28"
                aria-hidden="true"
              >
                {/* eixo/chassi */}
                <rect x="3" y="19" width="39" height="2" rx="1" fill="#4a4438" />
                {/* caçamba sólida, com ripas — antes era só a linha do chassi, */}
                {/* caçamba invisível (fill:none) sem corpo nenhum */}
                <rect x="4" y="14" width="37" height="5" rx="1" fill="#6b6459" />
                <rect x="4" y="14" width="37" height="1.5" fill="#87806f" opacity=".7" />
                <line x1="10" y1="15.5" x2="10" y2="18.5" stroke="#4a4438" strokeWidth=".6" opacity=".5" />
                <line x1="18" y1="15.5" x2="18" y2="18.5" stroke="#4a4438" strokeWidth=".6" opacity=".5" />
                <line x1="26" y1="15.5" x2="26" y2="18.5" stroke="#4a4438" strokeWidth=".6" opacity=".5" />
                <line x1="34" y1="15.5" x2="34" y2="18.5" stroke="#4a4438" strokeWidth=".6" opacity=".5" />
                {/* alvo invisível de onde o contêiner cai — mesma função de antes, */}
                {/* só reposicionado pra ficar dentro da caçamba visível */}
                <rect ref={bedRef} x="6" y="7" width="32" height="8" fill="none" />
                {/* postes com a mesma altura nos dois lados (antes: 14px vs 8px, torto) */}
                <rect x="3" y="6" width="3" height="9" rx="1" fill="#5a544c" />
                <rect x="38" y="6" width="3" height="9" rx="1" fill="#5a544c" />
                <rect x="3" y="5.5" width="38" height="1.3" fill="#87806f" opacity=".6" />
                {/* cabine com forma real (antes: dois blocos cinza empilhados) */}
                <path d="M42 19 V11 Q42 8 45 8 H50 Q54 8 55 11 L57 15.5 H60 Q61.5 15.5 61.5 17 V19 Z" fill="#5a6270" />
                <path d="M46 9.3 Q44 9.3 44 11.3 V13 H51.5 L50.5 9.3 Z" fill="#cdd6e0" />
                <line x1="48.5" y1="9" x2="48.5" y2="19" stroke="#454c58" strokeWidth=".6" />
                <circle cx="52.5" cy="14" r=".7" fill="#454c58" />
                <rect x="43.5" y="10.5" width="1.6" height="2.6" rx=".5" fill="#454c58" />
                <rect x="59.5" y="17.5" width="2.5" height="2.5" rx=".6" fill="#3f3a30" />
                <circle cx="60.7" cy="15" r="1.1" fill="#E8C34A" />
                <circle cx="13" cy="23" r="3.6" fill="#1c1a16" />
                <circle cx="13" cy="23" r="1.6" fill="#8a857c" />
                <circle className="vt-tiresmoke s1" cx="8" cy="20" r="2.6" fill="#847e73" />
                <circle className="vt-tiresmoke s2" cx="5" cy="17.5" r="2.1" fill="#a19a8c" />
                <circle className="vt-tiresmoke s3" cx="10.5" cy="16" r="1.7" fill="#bdb6a6" />
                <circle cx="50" cy="23" r="3.6" fill="#1c1a16" />
                <circle cx="50" cy="23" r="1.6" fill="#8a857c" />
              </svg>
              <Button
                ref={btnRef}
                variant="ghost"
                className={`vt-save-btn ${primaryBtn}`}
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </span>
        </div>
      </div>
    </div>
  );
}
