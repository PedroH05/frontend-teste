'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { Captacao, CaptacaoInput } from '@/lib/types';
import { cleanDesp } from '@/lib/despachante';
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
const STEPS = ['Identificação', 'Carga', 'Aduana', 'Terminal', 'Situação'] as const;

const REGIMES = ['DTA', 'DUIMP', 'DI', 'DAC', 'AGUARDANDO'];
const ATRACACOES = ['Santos Brasil', 'BTP', 'DPW', 'ECOPORTO'];
const PARCEIROS = ['ECOPORTO', 'MOVECTA', 'DPW'];

type FormState = CaptacaoInput & { publicaConfirmado?: boolean };

const initialForm: FormState = {};

export default function CaptacoesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Carregando…</div>}>
      <CaptacoesForm />
    </Suspense>
  );
}

function CaptacoesForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const [step, setStep] = useState(0);
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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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
        setForm({
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
        });
        setStatus(c.stage === 'EFETIVA' ? 'EFETIVA' : 'PENDENTE');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar captação');
      } finally {
        setLoadingEdit(false);
      }
    })();
  }, [editId]);

  function handlePublicaChange(checked: boolean) {
    if (checked && !confirm('Confirma marcar esta carga como tabela pública?')) return;
    set('prejuizoPublico', checked);
  }

  async function handleSubmit() {
    setError('');
    if (!form.cli?.trim()) {
      setError('Informe ao menos o cliente.');
      setStep(0);
      return;
    }
    setSaving(true);
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
      router.push('/historico');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar captação');
    } finally {
      setSaving(false);
    }
  }

  const showDocs = status !== 'EFETIVA';

  if (loadingEdit) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Carregando captação…</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-lg font-semibold">
          {editId ? 'Editar captação' : 'Captação manual'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Os mesmos campos da planilha — agora salvos direto na captacao-api
        </p>
      </div>

      <div className="flex gap-1 border-b pb-2 text-sm">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-md px-3 py-1.5 ${
              i === step ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
          <Field>
            <FieldLabel htmlFor="cli">Cliente</FieldLabel>
            <FieldContent>
              <Input id="cli" value={form.cli ?? ''} onChange={(e) => set('cli', e.target.value)} />
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
              <Input
                id="despachante"
                value={form.despachante ?? ''}
                onChange={(e) => set('despachante', e.target.value)}
              />
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
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm font-medium">Documentos recebidos do cliente</p>
              <div className="flex gap-6">
                {(['docBl', 'docCe', 'docPl'] as const).map((key, i) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form[key] ?? false}
                      onCheckedChange={(c) => set(key, c === true)}
                    />
                    {['BL', 'CE', 'PL'][i]}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.docBl && form.docCe && form.docPl
                  ? '⚠ Documentação completa recebida — precisa ser efetivada no terminal HOJE (crítico).'
                  : 'Marque o que já chegou. Documentação completa e ainda não efetivada = alerta de prejuízo.'}
              </p>
            </div>
          )}

          <div className="rounded-lg border p-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.prejuizoPublico ?? false}
                onCheckedChange={(c) => handlePublicaChange(c === true)}
              />
              Marcar como tabela pública
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Use apenas quando o prejuízo desta carga entra na tabela pública.
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          ‹ Anterior
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Próximo ›</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        )}
      </div>
    </div>
  );
}
