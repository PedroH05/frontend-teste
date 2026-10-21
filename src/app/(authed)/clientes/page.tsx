'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus, Search, UserPlus, X } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import type { Cliente } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { EmptyState } from '@/components/ship-scene';
import { TableSkeletonRows } from '@/components/table-skeleton';
import { RowActions } from '@/components/row-actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Comportamento portado de captacao-valetrade/public/index.html (cliAdd,
// cliDel). Ver migration-plan/features/clientes/CURRENT_BEHAVIOR.md e
// prompts/02-clientes.md. Apelidos como chips, edição inline e busca são
// melhorias — não existem no original, ver clientes-proposta.html.

// Apelidos como chips removíveis, não texto solto separado por vírgula —
// um espaço a mais no texto livre virava um alias fantasma sem dar match
// no import do Logcomex.
// CNPJ com máscara (HANDOFF seção 3): só dígitos, no máximo 14, formatado
// enquanto digita. Texto já formatado passa igual.
function mascaraCnpj(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function iniciais(nome: string): string {
  const palavras = nome.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  return ((palavras[0]?.[0] ?? '') + (palavras[1]?.[0] ?? palavras[0]?.[1] ?? '')).toUpperCase();
}

function AliasChips({ id, value, onChange }: { id?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function commit() {
    const v = draft.trim().toUpperCase();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {value.map((a, i) => (
        <span key={a} className="inline-flex items-center gap-1 rounded-md border bg-muted py-0.5 pr-1 pl-2 text-xs font-medium">
          {a}
          <button
            type="button"
            aria-label={`Remover ${a}`}
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={value.length ? '' : 'digite e tecle Enter…'}
        className="min-w-[90px] flex-1 border-0 bg-transparent p-1 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

type EditForm = { name: string; cnpj: string; aliases: string[] };

const PAGE_SIZE = 5; // mesmo tamanho da Carteira/Histórico — pedido 17/09/2026

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', cnpj: '', aliases: [] });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [pagina, setPagina] = useState(1);
  const [excluindo, setExcluindo] = useState<Cliente | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Cliente[]>('/clientes');
      setClientes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Busca de dado no mount — o setState relevante só acontece depois do
    // await dentro de load(), não sincronamente no corpo do efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const clientesFiltrados = useMemo(() => {
    if (!busca.trim()) return clientes;
    const q = busca.trim().toLowerCase();
    return clientes.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.cnpj ?? '').toLowerCase().includes(q) ||
        (c.cnpjRaiz ?? '').includes(q) ||
        c.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }, [clientes, busca]);

  // Volta pra página 1 quando a busca muda o conjunto exibido — mesmo
  // padrão da Carteira/Histórico. Ajuste durante o render, não em efeito.
  const [buscaAnterior, setBuscaAnterior] = useState(busca);
  if (buscaAnterior !== busca) {
    setBuscaAnterior(busca);
    setPagina(1);
  }
  const totalPaginas = Math.max(1, Math.ceil(clientesFiltrados.length / PAGE_SIZE));
  const clientesPagina = useMemo(
    () => clientesFiltrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
    [clientesFiltrados, pagina],
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!nome.trim()) {
      setError('Informe o nome do cliente.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch<Cliente>('/clientes', {
        method: 'POST',
        body: JSON.stringify({ name: nome, cnpj: cnpj || undefined, aliases }),
      });
      setNome('');
      setCnpj('');
      setAliases([]);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Já existe cliente cadastrado com essa raiz de CNPJ.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar cliente');
      }
    } finally {
      setSaving(false);
    }
  }

  // Confirmação no AlertDialog (redesign 21/10/2026), não mais confirm().
  async function handleDelete(id: number) {
    try {
      await apiFetch(`/clientes/${id}`, { method: 'DELETE' });
      // Tira da tela na hora — ver comentário equivalente em historico/page.tsx.
      setClientes((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir cliente');
    }
  }

  function startEdit(c: Cliente) {
    setEditingId(c.id);
    setEditForm({ name: c.name, cnpj: c.cnpj ?? '', aliases: [...c.aliases] });
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError('');
  }

  async function saveEdit(id: number) {
    setEditError('');
    if (!editForm.name.trim()) {
      setEditError('Informe o nome do cliente.');
      return;
    }
    setEditSaving(true);
    try {
      await apiFetch<Cliente>(`/clientes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editForm.name, cnpj: editForm.cnpj || undefined, aliases: editForm.aliases }),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setEditError('Já existe cliente cadastrado com essa raiz de CNPJ.');
      } else {
        setEditError(err instanceof ApiError ? err.message : 'Erro ao salvar cliente');
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    const { id } = excluindo;
    setExcluindo(null);
    await handleDelete(id);
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 p-6 sm:p-8 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>Gestão</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Clientes</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Clientes</h1>
        </div>
        {/* Busca no topo, junto do título (pedido 28/09/2026). */}
        <label className="flex h-10 w-[300px] max-w-full items-center gap-2 rounded-lg border bg-card px-3 shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Buscar cliente</span>
          <input
            placeholder="buscar cliente…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </header>

      {/* Cadastro em cima e tabela com a largura toda (21/10/2026): com o
          card ao lado, a tabela ficava estreita e precisava rolar pro lado. */}
      <div className="space-y-6">
        <section aria-labelledby="novo-cliente" className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
              <UserPlus className="size-4" aria-hidden="true" />
            </span>
            <h2 id="novo-cliente" className="text-[15px] font-semibold">
              Adicionar cliente
            </h2>
          </div>
          <form
            onSubmit={handleAdd}
            className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_auto]"
          >
            <Field>
              <FieldLabel htmlFor="cl-nome">Razão social / Nome</FieldLabel>
              <FieldContent>
                <Input id="cl-nome" className="h-10" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="cl-cnpj">CNPJ</FieldLabel>
              <FieldContent>
                <Input
                  id="cl-cnpj"
                  className="h-10 font-mono"
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(mascaraCnpj(e.target.value))}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="cl-aliases">Apelidos</FieldLabel>
              <FieldContent>
                <AliasChips id="cl-aliases" value={aliases} onChange={setAliases} />
              </FieldContent>
            </Field>
            <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-1 xl:pt-[26px]">
              <Button type="submit" className="h-10 px-4" disabled={saving}>
                <Plus />
                {saving ? 'Adicionando…' : 'Adicionar cliente'}
              </Button>
            </div>
            {error && <p className="text-sm font-medium text-destructive md:col-span-2 xl:col-span-4">{error}</p>}
          </form>
        </section>

        <section aria-label="Lista de clientes" className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-11 text-xs font-medium text-muted-foreground">Cliente</TableHead>
                <TableHead className="h-11 text-xs font-medium text-muted-foreground">CNPJ</TableHead>
                <TableHead className="h-11 text-xs font-medium text-muted-foreground">Apelidos</TableHead>
                <TableHead className="h-11 w-[96px]">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeletonRows columns={['twoLine', 'bar', 'bar', 'none']} />
              ) : clientesFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyState
                      title={busca ? 'Nenhum cliente com este filtro' : 'Nenhum cliente'}
                      subtitle={busca ? 'Tente limpar a busca.' : 'Cadastre o primeiro cliente no formulário ao lado.'}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                clientesPagina.map((c) =>
                  editingId === c.id ? (
                    <TableRow key={c.id} className="bg-warning-soft/50 hover:bg-warning-soft/50">
                      <TableCell className="whitespace-normal">
                        <Input
                          className="h-10"
                          aria-label="Nome do cliente"
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <Input
                          className="h-10 font-mono"
                          aria-label="CNPJ do cliente"
                          placeholder="00.000.000/0000-00"
                          value={editForm.cnpj}
                          onChange={(e) => setEditForm((f) => ({ ...f, cnpj: mascaraCnpj(e.target.value) }))}
                        />
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <AliasChips value={editForm.aliases} onChange={(v) => setEditForm((f) => ({ ...f, aliases: v }))} />
                        {editError && <p className="mt-1.5 text-xs font-medium text-destructive">{editError}</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 text-success hover:bg-success-soft hover:text-success"
                            title="Salvar"
                            onClick={() => saveEdit(c.id)}
                            disabled={editSaving}
                          >
                            <Check />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 text-muted-foreground"
                            title="Cancelar"
                            onClick={cancelEdit}
                            disabled={editSaving}
                          >
                            <X />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={c.id}>
                      <TableCell className="min-w-[220px] whitespace-normal">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground"
                          >
                            {iniciais(c.name)}
                          </span>
                          <span className="font-semibold">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[13px] whitespace-nowrap text-foreground/80">
                        {c.cnpj || '—'}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {c.aliases.length ? (
                          <div className="flex flex-wrap gap-1">
                            {c.aliases.map((a) => (
                              <Badge key={a} variant="outline" className="font-medium">
                                {a}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <RowActions nome={c.aliases[0] || c.name} onEdit={() => startEdit(c)} onDelete={() => setExcluindo(c)} />
                      </TableCell>
                    </TableRow>
                  ),
                )
              )}
            </TableBody>
          </Table>
          {!loading && clientesFiltrados.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5 text-[13px] text-muted-foreground">
              <span className="tabular-nums">
                Página {pagina} de {totalPaginas} · {clientesFiltrados.length} clientes
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  className="h-9 px-3"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  className="h-9 px-3"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                >
                  Próxima
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este cliente do cadastro?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo?.name} — esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmarExclusao}>
              Excluir cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
