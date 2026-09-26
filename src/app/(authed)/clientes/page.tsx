'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import type { Cliente } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import { EmptyState } from '@/components/ship-scene';
import { TableSkeletonRows } from '@/components/table-skeleton';
import { Search, Check, X } from 'lucide-react';
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
function AliasChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function commit() {
    const v = draft.trim().toUpperCase();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  }

  return (
    <div className="vt-glass-strong flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-[11px] border border-[var(--vt-line)] p-[7px_8px]">
      {value.map((a, i) => (
        <span key={a} className="vt-glass inline-flex items-center gap-1.5 rounded-[20px] px-2.5 py-1 text-[11.5px] font-semibold">
          {a}
          <button
            type="button"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            className="flex h-[15px] w-[15px] items-center justify-center rounded-full text-[9px]"
            style={{ background: 'var(--vt-line)', color: 'var(--vt-muted)' }}
          >
            ✕
          </button>
        </span>
      ))}
      <input
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
        className="min-w-[90px] flex-1 border-0 bg-transparent p-1 text-[12.5px] outline-none"
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

  async function handleDelete(id: number) {
    if (!confirm('Excluir este cliente do cadastro?')) return;
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

  const glassInput = 'vt-glass-strong rounded-[11px] border-[var(--vt-line)] text-[13px]';
  const primaryBtn = 'vt-btn-primary rounded-[11px] px-3.5 py-2 text-[12.5px] font-semibold transition hover:-translate-y-px';

  return (
    <div className="space-y-5 p-6 sm:p-8" style={{ color: 'var(--vt-ink)' }}>
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Clientes</h1>
          <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--vt-muted)' }}>
            Cadastro usado para identificar processos na planilha (CNPJ + apelidos)
          </p>
        </div>

        <form onSubmit={handleAdd} className="vt-glass grid gap-4 p-[18px_20px] sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="cl-nome">Razão social / Nome</FieldLabel>
            <FieldContent>
              <Input id="cl-nome" className={glassInput} value={nome} onChange={(e) => setNome(e.target.value)} required />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="cl-cnpj">CNPJ</FieldLabel>
            <FieldContent>
              <Input
                id="cl-cnpj"
                className={glassInput}
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="cl-aliases">Apelidos</FieldLabel>
            <FieldContent>
              <AliasChips value={aliases} onChange={setAliases} />
            </FieldContent>
          </Field>
          <div className="sm:col-span-3">
            {error && (
              <p className="mb-2 text-[13px] font-semibold" style={{ color: 'var(--vt-c-prej)' }}>
                {error}
              </p>
            )}
            <Button type="submit" variant="ghost" className={primaryBtn} disabled={saving}>
              {saving ? 'Adicionando…' : '+ Adicionar cliente'}
            </Button>
          </div>
        </form>

        <div className="vt-glass overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-[14px_18px]" style={{ borderBottom: '1px solid var(--vt-line2)' }}>
            <h3 className="text-[14px] font-bold">Clientes cadastrados</h3>
            <div className="relative ml-auto w-[200px]">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--vt-muted)' }} />
              <Input
                placeholder="buscar cliente…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className={`pl-8 text-[12.5px] ${glassInput}`}
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: 'var(--vt-line)' }}>
                <TableHead className="text-[11px] font-semibold tracking-[.05em] uppercase" style={{ color: 'var(--vt-muted)' }}>
                  Cliente
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-[.05em] uppercase" style={{ color: 'var(--vt-muted)' }}>
                  CNPJ (raiz)
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-[.05em] uppercase" style={{ color: 'var(--vt-muted)' }}>
                  Apelidos
                </TableHead>
                <TableHead />
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
                      subtitle={busca ? 'Tente limpar a busca.' : 'Cadastre o primeiro cliente no formulário acima.'}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                clientesPagina.map((c) =>
                  editingId === c.id ? (
                    <TableRow key={c.id} style={{ borderColor: 'var(--vt-line2)', background: 'var(--vt-bg-jan)' }}>
                      <TableCell>
                        <Input
                          className={glassInput}
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className={glassInput}
                          placeholder="00.000.000/0000-00"
                          value={editForm.cnpj}
                          onChange={(e) => setEditForm((f) => ({ ...f, cnpj: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell>
                        <AliasChips value={editForm.aliases} onChange={(v) => setEditForm((f) => ({ ...f, aliases: v }))} />
                        {editError && (
                          <p className="mt-1.5 text-[11px] font-semibold" style={{ color: 'var(--vt-c-prej)' }}>
                            {editError}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Salvar"
                            style={{ color: 'var(--vt-c-efet)' }}
                            onClick={() => saveEdit(c.id)}
                            disabled={editSaving}
                          >
                            <Check />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Cancelar"
                            style={{ color: 'var(--vt-muted)' }}
                            onClick={cancelEdit}
                            disabled={editSaving}
                          >
                            <X />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={c.id} style={{ borderColor: 'var(--vt-line2)' }}>
                      <TableCell className="font-bold" style={{ color: 'var(--vt-red)' }}>{c.name}</TableCell>
                      <TableCell className="font-mono text-xs">{c.cnpjRaiz || '—'}</TableCell>
                      <TableCell>{c.aliases.join(', ') || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <RowActions onEdit={() => startEdit(c)} onDelete={() => handleDelete(c.id)} />
                      </TableCell>
                    </TableRow>
                  ),
                )
              )}
            </TableBody>
          </Table>
          {!loading && clientesFiltrados.length > 0 && (
            <div
              className="flex items-center justify-between px-[18px] py-3 text-[12px]"
              style={{ borderTop: '1px solid var(--vt-line2)', color: 'var(--vt-muted)' }}
            >
              <span>
                Página {pagina} de {totalPaginas} · {clientesFiltrados.length} clientes
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  className="vt-glass-strong rounded-[9px] border border-[var(--vt-line)] px-2.5 py-1 text-[12px] font-semibold text-[var(--vt-ink)] shadow-[var(--vt-sh)] transition hover:-translate-y-px disabled:opacity-40"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  ‹ Anterior
                </Button>
                <Button
                  variant="ghost"
                  className="vt-glass-strong rounded-[9px] border border-[var(--vt-line)] px-2.5 py-1 text-[12px] font-semibold text-[var(--vt-ink)] shadow-[var(--vt-sh)] transition hover:-translate-y-px disabled:opacity-40"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                >
                  Próxima ›
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
