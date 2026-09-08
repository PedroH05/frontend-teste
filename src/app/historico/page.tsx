'use client';

import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import type { Captacao } from '@/lib/types';
import { splitBls } from '@/lib/bl-split';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

// Comportamento portado de captacao-valetrade/public/index.html
// (renderHistorico, setHistDia, setHistStatus). Ver
// migration-plan/features/historico/CURRENT_BEHAVIOR.md e
// migration-plan/prompts/05-historico.md. Sem rota de API própria — lê
// GET /captacoes (03-captacoes) e filtra no client, igual ao original.
type Dia = 'hoje' | 'ontem' | 'anteontem' | 'data' | 'tudo';
type StatusFiltro = 'todos' | 'conc' | 'efet' | 'and';

function inicioDoDia(offsetDias: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDias);
  return d;
}

function categoriaDe(stage: string | null): Exclude<StatusFiltro, 'todos'> {
  if (stage === 'SAIU_TERMINAL') return 'conc';
  if (stage === 'EFETIVA') return 'efet';
  return 'and';
}

function formatDataHora(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function formatData(v: string | null): string {
  if (!v) return '—';
  return v.slice(0, 10).split('-').reverse().join('/');
}

const STAGE_LABEL: Record<string, string> = {
  SAIU_TERMINAL: 'Concluído',
  EFETIVA: 'Efetivado',
};

export default function HistoricoPage() {
  const [captacoes, setCaptacoes] = useState<Captacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dia, setDia] = useState<Dia>('hoje');
  const [dataSel, setDataSel] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos');
  const [busca, setBusca] = useState('');
  const [drawerBls, setDrawerBls] = useState<string[] | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Captacao[]>('/captacoes');
      setCaptacoes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Busca no mount — setState só depois do await dentro de load().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const alvo = useMemo((): Date | null => {
    if (dia === 'hoje') return inicioDoDia(0);
    if (dia === 'ontem') return inicioDoDia(1);
    if (dia === 'anteontem') return inicioDoDia(2);
    if (dia === 'data' && dataSel) return new Date(`${dataSel}T12:00:00`);
    return null;
  }, [dia, dataSel]);

  const linhas = useMemo(() => {
    let rows = [...captacoes];
    if (alvo) {
      rows = rows.filter((c) => {
        const d = c.createdAt ? new Date(c.createdAt) : null;
        return d && !Number.isNaN(d.getTime()) && d.toDateString() === alvo.toDateString();
      });
      rows.sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
    } else {
      rows.sort((a, b) => ((b.eta ?? '') < (a.eta ?? '') ? -1 : 1));
    }
    if (statusFiltro !== 'todos') {
      rows = rows.filter((c) => categoriaDe(c.stage) === statusFiltro);
    }
    if (busca) {
      const q = busca.toLowerCase();
      rows = rows.filter((c) => JSON.stringify(c).toLowerCase().includes(q));
    }
    return rows;
  }, [captacoes, alvo, statusFiltro, busca]);

  async function handleDelete(id: number) {
    if (!confirm('Excluir este processo? Esta ação não pode ser desfeita.')) return;
    try {
      await apiFetch(`/captacoes/${id}`, { method: 'DELETE' });
      await load(); // fica no Histórico — não força navegação (ver features/captacoes)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Histórico</h1>
          <p className="text-sm text-muted-foreground">{linhas.length} captações</p>
        </div>
        <Input
          placeholder="buscar cliente, BL, navio…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['hoje', 'Hoje'],
            ['ontem', 'Ontem'],
            ['anteontem', 'Anteontem'],
            ['tudo', 'Tudo'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={dia === value ? 'default' : 'outline'}
            onClick={() => setDia(value)}
          >
            {label}
          </Button>
        ))}
        <Input
          type="date"
          className="w-auto"
          value={dataSel}
          onChange={(e) => {
            setDataSel(e.target.value);
            setDia(e.target.value ? 'data' : 'tudo');
          }}
        />
      </div>

      <div className="flex gap-2">
        {(
          [
            ['todos', 'Todos'],
            ['and', 'Em andamento'],
            ['efet', 'Efetivado'],
            ['conc', 'Concluído'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={statusFiltro === value ? 'default' : 'outline'}
            onClick={() => setStatusFiltro(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Cliente / Referência</TableHead>
              <TableHead>Registrado em</TableHead>
              <TableHead>ETA</TableHead>
              <TableHead>Regime</TableHead>
              <TableHead>CE</TableHead>
              <TableHead>BL</TableHead>
              <TableHead>Navio</TableHead>
              <TableHead>Despachante</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : linhas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Histórico vazio.
                </TableCell>
              </TableRow>
            ) : (
              linhas.map((c) => {
                const bls = splitBls(c.bl);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {STAGE_LABEL[c.stage ?? ''] ?? 'Em andamento'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.cli} <span className="text-muted-foreground">{c.referencia}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {formatDataHora(c.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatData(c.eta)}</TableCell>
                    <TableCell>{c.regime || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{c.ce || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {bls.length <= 1 ? (
                        <span title={c.bl ?? ''} className="inline-block max-w-[110px] truncate align-middle">
                          {c.bl || '—'}
                        </span>
                      ) : (
                        <>
                          <span title={c.bl ?? ''} className="inline-block max-w-[110px] truncate align-middle">
                            {bls[0]}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDrawerBls(bls)}
                            className="ml-1 text-xs font-semibold text-destructive hover:underline"
                          >
                            +{bls.length - 1}
                          </button>
                        </>
                      )}
                    </TableCell>
                    <TableCell>{c.navio || '—'}</TableCell>
                    <TableCell>{c.despachante || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/captacoes?edit=${c.id}`}
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                      >
                        Editar
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Drawer open={drawerBls !== null} onOpenChange={(open) => !open && setDrawerBls(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>BLs deste processo</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4 pb-4">
            {(drawerBls ?? []).map((bl, i) => (
              <div
                key={bl + i}
                className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm"
              >
                {bl}
                <span className="text-xs text-muted-foreground">BL {i + 1}</span>
              </div>
            ))}
          </div>
          <DrawerFooter>
            <DrawerClose render={<Button variant="outline">Fechar</Button>} />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
