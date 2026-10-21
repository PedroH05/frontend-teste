'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ptBR } from 'react-day-picker/locale';
import {
  AlertTriangle,
  ArrowRight,
  CalendarIcon,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch, ApiError } from '@/lib/api';
import type { Captacao, CaptacaoInput, Cliente } from '@/lib/types';
import { cleanDesp, DESPACHANTES_PADRAO } from '@/lib/despachante';
import { listaConts } from '@/lib/conteineres';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, ProgressLabel } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NotasPainel } from '@/components/notas-painel';

// Comportamento portado de captacao-valetrade/public/index.html
// (salvarManual, manualStep). Ver
// migration-plan/features/captacoes/CURRENT_BEHAVIOR.md e
// migration-plan/prompts/03-captacoes.md pra fórmula exata de
// stage/doc_*/doc_recebida_em (calculada no backend a partir de
// `efetivada` + `docBl`/`docCe`/`docPl`, não recalculada aqui).
//
// Visual redesenhado em 21/10/2026 (docs/valetrade-redesign/HANDOFF.md
// seções 4 e 5): stepper vertical, estado de cada etapa calculado só pelos
// dados (não mais por "já visitada"), Revisão em três blocos.
const STEPS = ['Identificação', 'Carga', 'Aduana', 'Terminal', 'Situação', 'Carregamento', 'Revisão'] as const;
const REVISAO = STEPS.length - 1;
const ETAPAS_COM_CAMPOS = [0, 1, 2, 3, 4, 5];

const DESCRICOES: Record<number, string> = {
  0: 'Quem é o cliente e qual a referência do processo.',
  1: 'Navio, chegada prevista e contêineres.',
  2: 'Documentos e despacho aduaneiro.',
  3: 'De onde a carga sai e pra qual parceiro vai.',
  4: 'Status da captação e observações.',
  5: 'Datas de carregamento e chegada no destino.',
};

const STATUS_LABEL = {
  PENDENTE: 'Pendente de documentação',
  EFETIVA: 'Captação efetivada no terminal',
} as const;

function fmtDateBR(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

// Data "AAAA-MM-DD" sempre montada no fuso local — `new Date(iso)` leria
// como meia-noite UTC e mostraria o dia anterior no Brasil.
function parseISODateLocal(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toISODateLocal(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function relativoDias(iso?: string): string | null {
  const alvo = parseISODateLocal(iso);
  if (!alvo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
  if (dias === 0) return 'hoje';
  return dias > 0 ? `em ${dias}d` : `há ${-dias}d`;
}

// `boolean` conta como preenchido só quando `true` (ex.: doc recebido
// marcado) — mesma regra de antes do redesign (pedido 17/09/2026).
function estaPreenchido(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

const REGIMES = ['DTA', 'DUIMP', 'DI', 'DAC', 'AGUARDANDO'];
const ATRACACOES = ['Santos Brasil', 'BTP', 'DPW', 'ECOPORTO'];
const PARCEIROS = ['ECOPORTO', 'MOVECTA', 'DPW'];

type FormState = CaptacaoInput & { publicaConfirmado?: boolean };
type Campo = { label: string; value: unknown; tipo?: 'data' | 'bool' | 'mono' };
type EstadoEtapa = 'atual' | 'completa' | 'vazios' | 'pendente';

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

const CIRCULO: Record<EstadoEtapa, string> = {
  atual: 'bg-primary text-primary-foreground ring-4 ring-primary/15',
  completa: 'bg-success text-white',
  vazios: 'border border-warning-border bg-warning-soft text-warning-text',
  pendente: 'border border-border bg-card text-muted-foreground',
};

function Circulo({ estado, n, className }: { estado: EstadoEtapa; n: number; className?: string }) {
  return (
    <span
      data-estado={estado}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        CIRCULO[estado],
        className,
      )}
    >
      {estado === 'completa' ? <Check className="size-3.5" strokeWidth={3} aria-label="completa" /> : n}
    </span>
  );
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

function DateField({
  id,
  label,
  value,
  onChange,
  relativo,
}: {
  id: string;
  label: string;
  value?: string;
  onChange: (iso: string | undefined) => void;
  relativo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseISODateLocal(value);
  const rel = relativo ? relativoDias(value) : null;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <FieldContent>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            id={id}
            render={<Button variant="outline" className="h-10 w-full justify-start px-3 font-normal" />}
          >
            <CalendarIcon className="text-muted-foreground" />
            {selected ? fmtDateBR(value) : <span className="text-muted-foreground">Selecionar data</span>}
            {rel && <span className="ml-auto text-xs text-muted-foreground">{rel}</span>}
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-xl border bg-popover p-0 shadow-md">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={selected}
              defaultMonth={selected}
              onSelect={(d) => {
                onChange(d ? toISODateLocal(d) : undefined);
                setOpen(false);
              }}
            />
            {selected && (
              <div className="border-t p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  Limpar data
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </FieldContent>
    </Field>
  );
}

// Contêineres continuam salvos numa string só (mesmo campo de antes); aqui
// só a apresentação virou etiquetas. Separadores iguais aos de `listaConts`.
function ConteineresInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  const [rascunho, setRascunho] = useState('');
  const lista = listaConts(value);

  function adicionar(texto: string) {
    const novos = listaConts(texto);
    if (!novos.length) return;
    onChange([...lista, ...novos].join(' / '));
    setRascunho('');
  }

  function remover(i: number) {
    onChange(lista.filter((_, k) => k !== i).join(' / '));
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {lista.map((c, i) => (
        <span
          key={`${c}-${i}`}
          className="inline-flex items-center gap-1 rounded-md border bg-muted py-0.5 pr-1 pl-2 font-mono text-xs"
        >
          {c}
          <button
            type="button"
            aria-label={`Remover ${c}`}
            onClick={() => remover(i)}
            className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={rascunho}
        placeholder={lista.length ? 'adicionar…' : 'ex.: HLBU1763320 / FFAU5450940'}
        className="min-w-[140px] flex-1 bg-transparent px-1 font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted-foreground"
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={() => adicionar(rascunho)}
        onPaste={(e) => {
          const texto = e.clipboardData.getData('text');
          if (listaConts(texto).length > 1) {
            e.preventDefault();
            adicionar(rascunho + ' ' + texto);
          }
        }}
        onKeyDown={(e) => {
          if (['Enter', ',', ';', ' ', '/'].includes(e.key) && rascunho.trim()) {
            // Enter com texto vira etiqueta — não avança de etapa
            e.preventDefault();
            e.stopPropagation();
            adicionar(rascunho);
          } else if (e.key === 'Backspace' && !rascunho && lista.length) {
            remover(lista.length - 1);
          }
        }}
      />
    </div>
  );
}

export default function CaptacoesPage() {
  return (
    <Suspense fallback={<div className="p-6 sm:p-8"><Skeleton className="h-6 w-56" /></div>}>
      <CaptacoesForm />
    </Suspense>
  );
}

function CaptacoesForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  // Carteira e Histórico levam direto pra Revisão (?step=6) ao clicar num
  // processo — pedido 23/09/2026, pra reaproveitar esta tela como o "ver
  // detalhes" das duas, no lugar de um drawer à parte.
  const initialStep = (() => {
    const raw = Number(searchParams.get('step'));
    return Number.isInteger(raw) && raw >= 0 && raw < STEPS.length ? raw : 0;
  })();
  const [step, setStep] = useState(initialStep);

  function goToStep(i: number) {
    setStep(i);
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
          dataCarregamento: c.dataCarregamento ? c.dataCarregamento.slice(0, 10) : undefined,
          transportadora: c.transportadora ?? '',
          dataChegada: c.dataChegada ? c.dataChegada.slice(0, 10) : undefined,
          dataChegadaDestino: c.dataChegadaDestino ? c.dataChegadaDestino.slice(0, 10) : undefined,
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

  // Confirmação agora é o AlertDialog do botão Excluir (redesign 21/10/2026),
  // no lugar do confirm() nativo.
  async function handleDelete() {
    if (!editId) return;
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
  const erroCliente = error === 'Informe ao menos o cliente.';

  // Campos de cada etapa — mesma lista que já decidia a cor da bolinha antes
  // do redesign; agora também alimenta resumo do stepper e Revisão inteira.
  function camposEtapa(i: number): Campo[] {
    switch (i) {
      case 0:
        return [
          { label: 'CNPJ', value: form.cnpj, tipo: 'mono' },
          { label: 'Cliente', value: form.cli },
          { label: 'Referência', value: form.referencia, tipo: 'mono' },
        ];
      case 1:
        return [
          { label: 'ETA', value: form.eta, tipo: 'data' },
          { label: 'Navio', value: form.navio },
          { label: 'Qtde de contêineres', value: form.quantidade },
          { label: 'Contêineres', value: form.container, tipo: 'mono' },
        ];
      case 2:
        return [
          { label: 'CE Mercante', value: form.ce, tipo: 'mono' },
          { label: 'Regime', value: form.regime },
          { label: 'HBL', value: form.bl, tipo: 'mono' },
          { label: 'Despachante', value: form.despachante },
        ];
      case 3:
        return [
          { label: 'Atracação', value: form.terminalDescarga },
          { label: 'Parceiro (captado)', value: form.terminalCaptado },
        ];
      case 4:
        return [
          { label: 'Observação', value: form.observacao },
          ...(showDocs
            ? [
                { label: 'BL recebido', value: form.docBl, tipo: 'bool' as const },
                { label: 'CE recebido', value: form.docCe, tipo: 'bool' as const },
                { label: 'PL recebido', value: form.docPl, tipo: 'bool' as const },
              ]
            : []),
          { label: 'Tabela pública', value: form.prejuizoPublico, tipo: 'bool' },
        ];
      case 5:
        return [
          { label: 'Data de carregamento', value: form.dataCarregamento, tipo: 'data' },
          { label: 'Transportadora', value: form.transportadora },
          { label: 'Data de chegada (destino)', value: form.dataChegadaDestino, tipo: 'data' },
        ];
      default:
        return [];
    }
  }

  function vaziosEtapa(i: number): string[] {
    return camposEtapa(i)
      .filter((c) => !estaPreenchido(c.value))
      .map((c) => c.label);
  }

  // Só pelos dados (HANDOFF seção 4): etapa incompleta não fica mais
  // vermelha igual à atual, e a Revisão não nasce verde.
  function estadoEtapa(i: number): EstadoEtapa {
    if (i === step) return 'atual';
    if (i === REVISAO) return 'pendente';
    return vaziosEtapa(i).length === 0 ? 'completa' : 'vazios';
  }

  function resumoConteudo(i: number): string | undefined {
    switch (i) {
      case 0:
        return form.cli || form.cnpj || undefined;
      case 1: {
        const qtde = form.quantidade ? plural(form.quantidade, 'contêiner', 'contêineres') : undefined;
        return [form.navio, qtde].filter(Boolean).join(' · ') || undefined;
      }
      case 2:
        return [form.ce && `CE ${form.ce}`, form.despachante].filter(Boolean).join(' · ') || undefined;
      case 3:
        return [form.terminalDescarga, form.terminalCaptado].filter(Boolean).join(' → ') || undefined;
      case 4:
        return STATUS_LABEL[status];
      case 5:
        return [form.transportadora, fmtDateBR(form.dataCarregamento)].filter(Boolean).join(' · ') || undefined;
      default:
        return undefined;
    }
  }

  const etapasCompletas = ETAPAS_COM_CAMPOS.filter((i) => vaziosEtapa(i).length === 0).length;
  const etapasComVazios = ETAPAS_COM_CAMPOS.filter((i) => vaziosEtapa(i).length > 0);
  const totalCampos = ETAPAS_COM_CAMPOS.reduce((n, i) => n + camposEtapa(i).length, 0);
  const totalPreenchidos = ETAPAS_COM_CAMPOS.reduce(
    (n, i) => n + camposEtapa(i).filter((c) => estaPreenchido(c.value)).length,
    0,
  );

  const qtdConts = listaConts(form.container).length;
  const carregamentoVazio = !form.dataCarregamento && !form.transportadora && !form.dataChegadaDestino;

  function valorFicha(c: Campo): string {
    if (c.tipo === 'data') return fmtDateBR(c.value as string);
    if (c.tipo === 'bool') return 'Sim';
    return String(c.value);
  }

  if (loadingEdit) {
    return (
      <div className="mx-auto w-full max-w-[1240px] space-y-6 p-6 sm:p-8" role="status" aria-label="Carregando captação">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      </div>
    );
  }

  const triggerCls = 'h-10 w-full';

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 p-6 sm:p-8 lg:px-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href="/carteira" />}>Carteira</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{editId ? 'Editar captação' : 'Captação manual'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">
            {editId ? 'Editar captação' : 'Captação manual'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Os mesmos campos da planilha — agora salvos direto na captacao-api
          </p>
        </div>
        {editId && <NotasPainel captacaoId={Number(editId)} />}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="gap-4 shadow-sm lg:sticky lg:top-6">
          <CardHeader>
            <Progress value={(etapasCompletas / ETAPAS_COM_CAMPOS.length) * 100} className="gap-2">
              <ProgressLabel className="text-[13px]">Progresso</ProgressLabel>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {etapasCompletas} de {ETAPAS_COM_CAMPOS.length} etapas completas
              </span>
            </Progress>
          </CardHeader>
          <CardContent className="px-2">
            <nav aria-label="Etapas">
              <ol className="space-y-0.5">
                {STEPS.map((label, i) => {
                  const estado = estadoEtapa(i);
                  const vazios = i === REVISAO ? 0 : vaziosEtapa(i).length;
                  const resumo =
                    estado === 'vazios'
                      ? plural(vazios, 'campo vazio', 'campos vazios')
                      : i === REVISAO
                        ? undefined
                        : resumoConteudo(i);
                  return (
                    <li key={label}>
                      <button
                        type="button"
                        onClick={() => goToStep(i)}
                        aria-current={i === step ? 'step' : undefined}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-muted',
                          i === step && 'bg-accent hover:bg-accent',
                        )}
                      >
                        <Circulo estado={estado} n={i + 1} />
                        <span className="min-w-0 pt-0.5">
                          <span className="block text-sm font-medium">{label}</span>
                          {resumo && (
                            <span
                              className={cn(
                                'block truncate text-xs',
                                estado === 'vazios' ? 'text-warning-text' : 'text-muted-foreground',
                              )}
                            >
                              {resumo}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {step < REVISAO ? (
            <Card className="gap-6 py-6 shadow-sm">
              <CardHeader className="px-6">
                <span className="text-xs font-semibold tracking-wider text-primary uppercase">
                  Etapa {step + 1} de {STEPS.length}
                </span>
                <CardTitle className="text-lg font-semibold">{STEPS[step]}</CardTitle>
                <CardDescription>{DESCRICOES[step]}</CardDescription>
              </CardHeader>
              <CardContent className="px-6" onKeyDown={handleStepKeyDown}>
                {step === 0 && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="cnpj">CNPJ do cliente</FieldLabel>
                      <FieldContent>
                        <Input
                          id="cnpj"
                          className="h-10 font-mono"
                          placeholder="00.000.000/0000-00"
                          value={form.cnpj ?? ''}
                          onChange={(e) => set('cnpj', e.target.value)}
                        />
                      </FieldContent>
                    </Field>
                    <Field className="relative">
                      <FieldLabel htmlFor="cli">
                        Cliente {erroCliente && <span className="text-destructive">*</span>}
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          id="cli"
                          className="h-10"
                          autoComplete="off"
                          aria-invalid={erroCliente || undefined}
                          value={form.cli ?? ''}
                          onChange={(e) => {
                            set('cli', e.target.value);
                            setSugestaoAberta(true);
                          }}
                          onFocus={() => setSugestaoAberta(true)}
                          onBlur={() => setTimeout(() => setSugestaoAberta(false), 150)}
                        />
                        {erroCliente && (
                          <span className="text-xs font-medium text-destructive">Campo obrigatório</span>
                        )}
                        {sugestaoAberta && sugestoesCliente.length > 0 && (
                          <ul
                            className="absolute top-full left-0 z-20 mt-1 w-full overflow-hidden rounded-lg border bg-popover p-1 shadow-md"
                            role="listbox"
                          >
                            {sugestoesCliente.map((c) => (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={false}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                                  // onMouseDown (não onClick) dispara antes do onBlur do
                                  // input, senão a lista some antes do clique registrar.
                                  onMouseDown={() => selecionarCliente(c)}
                                >
                                  <span className="font-medium">{c.aliases[0] || c.name}</span>
                                  {c.cnpj && (
                                    <span className="ml-auto font-mono text-xs text-muted-foreground">{c.cnpj}</span>
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
                          className="h-10 font-mono"
                          value={form.referencia ?? ''}
                          onChange={(e) => set('referencia', e.target.value)}
                        />
                      </FieldContent>
                    </Field>
                  </div>
                )}

                {step === 1 && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <DateField id="eta" label="ETA" value={form.eta} relativo onChange={(v) => set('eta', v)} />
                    <Field>
                      <FieldLabel htmlFor="navio">Navio</FieldLabel>
                      <FieldContent>
                        <Input
                          id="navio"
                          className="h-10"
                          value={form.navio ?? ''}
                          onChange={(e) => set('navio', e.target.value)}
                        />
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="quantidade">Qtde de contêineres</FieldLabel>
                      <FieldContent>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-10"
                            aria-label="Diminuir quantidade"
                            disabled={!form.quantidade || form.quantidade <= 1}
                            onClick={() => set('quantidade', Math.max(1, (form.quantidade ?? 1) - 1))}
                          >
                            <Minus />
                          </Button>
                          <Input
                            id="quantidade"
                            type="number"
                            min={1}
                            className="h-10 w-20 text-center tabular-nums"
                            value={form.quantidade ?? ''}
                            onChange={(e) => set('quantidade', e.target.value ? Number(e.target.value) : undefined)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-10"
                            aria-label="Aumentar quantidade"
                            onClick={() => set('quantidade', (form.quantidade ?? 0) + 1)}
                          >
                            <Plus />
                          </Button>
                        </div>
                      </FieldContent>
                    </Field>
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor="container">Contêineres</FieldLabel>
                      <FieldContent>
                        <ConteineresInput
                          id="container"
                          value={form.container}
                          onChange={(v) => set('container', v)}
                        />
                        {qtdConts > 0 && (
                          <p
                            className={cn(
                              'flex items-center gap-1.5 text-xs font-medium',
                              !form.quantidade
                                ? 'text-muted-foreground'
                                : qtdConts === form.quantidade
                                  ? 'text-success-text'
                                  : 'text-warning-text',
                            )}
                          >
                            {form.quantidade && qtdConts === form.quantidade && <CheckCircle2 className="size-3.5" />}
                            {form.quantidade && qtdConts !== form.quantidade && <AlertTriangle className="size-3.5" />}
                            {plural(qtdConts, 'contêiner informado', 'contêineres informados')}
                            {form.quantidade
                              ? qtdConts === form.quantidade
                                ? ' — bate com a quantidade'
                                : ` — a quantidade diz ${form.quantidade}`
                              : ''}
                          </p>
                        )}
                      </FieldContent>
                    </Field>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="ce">CE Mercante</FieldLabel>
                      <FieldContent>
                        <Input
                          id="ce"
                          className="h-10 font-mono"
                          value={form.ce ?? ''}
                          onChange={(e) => set('ce', e.target.value)}
                        />
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="bl">HBL</FieldLabel>
                      <FieldContent>
                        <Input
                          id="bl"
                          className="h-10 font-mono"
                          placeholder="ex.: HBCN066406"
                          value={form.bl ?? ''}
                          onChange={(e) => set('bl', e.target.value)}
                        />
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="regime">Regime aduaneiro</FieldLabel>
                      <FieldContent>
                        <Select value={form.regime} onValueChange={(v) => set('regime', v as string)}>
                          <SelectTrigger id="regime" className={triggerCls}>
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
                          <SelectTrigger id="despachante" className={triggerCls}>
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
                            className="mt-1.5 h-10"
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
                  <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
                    <Field>
                      <FieldLabel htmlFor="atrac">Atracação</FieldLabel>
                      <FieldContent>
                        <Select value={form.terminalDescarga} onValueChange={(v) => set('terminalDescarga', v as string)}>
                          <SelectTrigger id="atrac" className={triggerCls}>
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
                    <ArrowRight
                      aria-hidden="true"
                      className="mx-auto mb-2.5 size-5 rotate-90 text-muted-foreground sm:rotate-0"
                    />
                    <Field>
                      <FieldLabel htmlFor="parc">Parceiro (captado)</FieldLabel>
                      <FieldContent>
                        <Select value={form.terminalCaptado} onValueChange={(v) => set('terminalCaptado', v as string)}>
                          <SelectTrigger id="parc" className={triggerCls}>
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
                  <div className="space-y-5">
                    <Field>
                      <FieldLabel htmlFor="status">Status da captação</FieldLabel>
                      <FieldContent>
                        <Select value={status} onValueChange={(v) => setStatus(v as 'PENDENTE' | 'EFETIVA')}>
                          <SelectTrigger id="status" className={cn(triggerCls, 'sm:max-w-sm')}>
                            <span
                              aria-hidden="true"
                              className={cn('size-2 shrink-0 rounded-full', status === 'EFETIVA' ? 'bg-success' : 'bg-warning')}
                            />
                            <SelectValue>{STATUS_LABEL[status]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDENTE">{STATUS_LABEL.PENDENTE}</SelectItem>
                            <SelectItem value="EFETIVA">{STATUS_LABEL.EFETIVA}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="observacao">
                        Observação <span className="font-normal text-muted-foreground">(opcional)</span>
                      </FieldLabel>
                      <FieldContent>
                        <Textarea
                          id="observacao"
                          rows={3}
                          value={form.observacao ?? ''}
                          onChange={(e) => set('observacao', e.target.value)}
                        />
                      </FieldContent>
                    </Field>

                    {showDocs && (
                      <div className="space-y-2.5 rounded-lg border p-4">
                        <p className="text-sm font-medium">Documentos recebidos do cliente</p>
                        <div className="flex gap-6">
                          {(['docBl', 'docCe', 'docPl'] as const).map((key, i) => (
                            <label key={key} className="flex items-center gap-2 text-sm font-medium">
                              <Checkbox checked={form[key] ?? false} onCheckedChange={(c) => set(key, c === true)} />
                              {['BL', 'CE', 'PL'][i]}
                            </label>
                          ))}
                        </div>
                        <p
                          className={cn(
                            'text-xs',
                            form.docBl && form.docCe && form.docPl ? 'font-medium text-primary' : 'text-muted-foreground',
                          )}
                        >
                          {form.docBl && form.docCe && form.docPl
                            ? '⚠ Documentação completa recebida — precisa ser efetivada no terminal HOJE (crítico).'
                            : 'Marque o que já chegou. Documentação completa e ainda não efetivada = alerta de prejuízo.'}
                        </p>
                      </div>
                    )}

                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/50">
                      <Checkbox
                        className="mt-0.5"
                        checked={form.prejuizoPublico ?? false}
                        onCheckedChange={(c) => handlePublicaChange(c === true)}
                      />
                      <span>
                        <span className="block text-sm font-medium">Marcar como tabela pública</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Use apenas quando o prejuízo desta carga entra na tabela pública.
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                {step === 5 && (
                  <div className="space-y-5">
                    {carregamentoVazio && (
                      <Alert className="border-warning-border bg-warning-soft text-warning-text">
                        <AlertTriangle />
                        <AlertTitle>Nada preenchido nesta etapa</AlertTitle>
                        <AlertDescription className="text-warning-text/90">
                          Dá pra salvar e completar depois.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid gap-5 sm:grid-cols-2">
                      <DateField
                        id="dataCarregamento"
                        label="Data de carregamento"
                        value={form.dataCarregamento}
                        onChange={(v) => set('dataCarregamento', v)}
                      />
                      <DateField
                        id="dataChegadaDestino"
                        label="Data de chegada (destino)"
                        value={form.dataChegadaDestino}
                        onChange={(v) => set('dataChegadaDestino', v)}
                      />
                      <Field>
                        <FieldLabel htmlFor="transportadora">Transportadora</FieldLabel>
                        <FieldContent>
                          <Input
                            id="transportadora"
                            className="h-10"
                            placeholder="ex.: Rodomax"
                            value={form.transportadora ?? ''}
                            onChange={(e) => set('transportadora', e.target.value)}
                          />
                        </FieldContent>
                      </Field>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-0.5">
                <span className="text-xs font-semibold tracking-wider text-primary uppercase">
                  Etapa {STEPS.length} de {STEPS.length}
                </span>
                <h2 className="text-lg font-semibold">Revisão</h2>
              </div>

              {/* 1 · Resumo do processo */}
              <Card className="gap-0 py-0 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/50 px-6 py-5">
                  <div className="min-w-0 flex-1">
                    <div className={cn('text-[22px] font-semibold', !form.cli && 'text-muted-foreground')}>
                      {form.cli || 'Cliente não informado'}
                    </div>
                    {form.cnpj && <div className="font-mono text-xs text-muted-foreground">{form.cnpj}</div>}
                  </div>
                  {form.referencia && (
                    <span className="rounded-md border bg-card px-2 py-1 font-mono text-xs">{form.referencia}</span>
                  )}
                  <Badge
                    className={cn(
                      'gap-1 border-0',
                      status === 'EFETIVA' ? 'bg-success-soft text-success-text' : 'bg-warning-soft text-warning-text',
                    )}
                  >
                    {status === 'EFETIVA' && <Check className="size-3" />}
                    {STATUS_LABEL[status]}
                  </Badge>
                </div>
                <dl className="grid grid-cols-2 gap-5 px-6 py-5 md:grid-cols-4">
                  {[
                    {
                      label: 'Navio',
                      valor: form.navio,
                      meta: form.eta ? `ETA ${fmtDateBR(form.eta)} · ${relativoDias(form.eta)}` : undefined,
                    },
                    {
                      label: 'Contêineres',
                      valor: form.quantidade ? String(form.quantidade) : qtdConts ? String(qtdConts) : undefined,
                      meta: listaConts(form.container).join(', ') || undefined,
                      mono: true,
                    },
                    {
                      label: 'Rota',
                      valor:
                        form.terminalDescarga || form.terminalCaptado
                          ? `${form.terminalDescarga || '—'} → ${form.terminalCaptado || '—'}`
                          : undefined,
                      meta: 'Atracação → Parceiro',
                    },
                    { label: 'Despacho', valor: form.despachante, meta: form.regime },
                  ].map((cel) => (
                    <div key={cel.label} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{cel.label}</dt>
                      <dd className={cn('mt-1 truncate text-[15px] font-semibold', !cel.valor && 'text-warning-text')}>
                        {cel.valor || 'Vazio'}
                      </dd>
                      {cel.meta && (
                        <dd className={cn('mt-0.5 truncate text-xs text-muted-foreground', cel.mono && 'font-mono')}>
                          {cel.meta}
                        </dd>
                      )}
                    </div>
                  ))}
                </dl>
              </Card>

              {/* 2 · O que ficou vazio */}
              {etapasComVazios.length > 0 && (
                <Alert className="gap-3 border-warning-border bg-warning-soft px-4 py-4 text-warning-text">
                  <AlertTriangle />
                  <AlertTitle className="text-sm font-semibold">
                    {plural(etapasComVazios.length, 'etapa com campos vazios', 'etapas com campos vazios')}
                  </AlertTitle>
                  <AlertDescription className="text-warning-text/90">
                    Dá pra salvar assim e completar depois.
                    <ul className="mt-3 divide-y divide-warning-border">
                      {etapasComVazios.map((i) => (
                        <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
                          <Badge variant="outline" className="border-warning-border bg-card text-warning-text">
                            {i + 1} · {STEPS[i]}
                          </Badge>
                          <span className="min-w-0 flex-1 text-xs">{vaziosEtapa(i).join(', ')}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-warning-border bg-card text-warning-text hover:bg-card/80"
                            onClick={() => goToStep(i)}
                          >
                            Preencher
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* 3 · Ficha completa */}
              <Card className="gap-0 py-0 shadow-sm">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <h2 className="text-[15px] font-semibold">Ficha completa</h2>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {totalPreenchidos} de {totalCampos} campos preenchidos
                  </span>
                </div>
                <div className="divide-y">
                  {ETAPAS_COM_CAMPOS.map((i) => (
                    <section key={i} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-start">
                      <div className="flex w-40 shrink-0 items-center gap-2.5">
                        <Circulo estado={estadoEtapa(i)} n={i + 1} className="size-6 text-[11px]" />
                        <h3 className="text-sm font-medium">{STEPS[i]}</h3>
                      </div>
                      <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-3">
                        {camposEtapa(i).map((c) => (
                          <div key={c.label} className="min-w-0">
                            <dt className="text-[11px] text-muted-foreground">{c.label}</dt>
                            {estaPreenchido(c.value) ? (
                              <dd className={cn('mt-0.5 text-[13px] font-medium break-words', c.tipo === 'mono' && 'font-mono')}>
                                {valorFicha(c)}
                              </dd>
                            ) : (
                              <dd className="mt-0.5 flex items-center gap-1.5 text-[13px] font-medium text-warning-text">
                                <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
                                Vazio
                              </dd>
                            )}
                          </div>
                        ))}
                      </dl>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto shrink-0 self-start px-0"
                        onClick={() => goToStep(i)}
                        aria-label={`Editar ${STEPS[i]}`}
                      >
                        Editar
                      </Button>
                    </section>
                  ))}
                </div>
              </Card>
            </>
          )}

          {error && !erroCliente && <p className="text-sm font-medium text-destructive">{error}</p>}

          {/* Sem overflow-hidden (não usa <Card>): o caminhão do Salvar
              aparece abaixo do botão e sai andando pra direita. */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-4 py-3 shadow-sm ring-1 ring-foreground/10">
            <Button variant="outline" className="h-10 px-4" onClick={handleExit}>
              Sair
            </Button>
            <Button
              variant="outline"
              className="h-10 px-3"
              onClick={() => goToStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              <ChevronLeft />
              Anterior
            </Button>
            <span className="flex-1" />
            {editId && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="ghost" className="h-10 px-4 text-destructive hover:text-destructive" />}
                  disabled={saving}
                >
                  Excluir
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir este processo?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={saving}>
                      Excluir processo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {step < REVISAO && (
              <Button variant="outline" className="h-10 px-3" onClick={() => goToStep(Math.min(REVISAO, step + 1))}>
                Próximo
                <ChevronRight />
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
              <Button ref={btnRef} className="vt-save-btn h-10 px-5" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
