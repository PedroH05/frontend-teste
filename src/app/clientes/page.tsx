'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import type { Cliente } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
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
// prompts/02-clientes.md.
export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [aliases, setAliases] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
        body: JSON.stringify({
          name: nome,
          cnpj: cnpj || undefined,
          aliases: aliases
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
        }),
      });
      setNome('');
      setCnpj('');
      setAliases('');
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
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir cliente');
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-lg font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro usado para identificar processos na planilha (CNPJ + apelidos)
        </p>
      </div>

      <form onSubmit={handleAdd} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="cl-nome">Razão social / Nome</FieldLabel>
          <FieldContent>
            <Input id="cl-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="cl-cnpj">CNPJ</FieldLabel>
          <FieldContent>
            <Input
              id="cl-cnpj"
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
            />
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="cl-aliases">Apelidos (separados por vírgula)</FieldLabel>
          <FieldContent>
            <Input
              id="cl-aliases"
              placeholder="ex.: TECNOAMERICA, TECNO AMERICA"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
            />
          </FieldContent>
        </Field>
        <div className="sm:col-span-3">
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? 'Adicionando…' : '+ Adicionar cliente'}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>CNPJ (raiz)</TableHead>
              <TableHead>Apelidos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : clientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum cliente cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.cnpjRaiz || '—'}</TableCell>
                  <TableCell>{c.aliases.join(', ') || '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                      Excluir
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
