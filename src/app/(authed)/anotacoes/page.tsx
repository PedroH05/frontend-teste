'use client';

import { useEffect, useState } from 'react';
import { PencilRuler, Plus, Search, StickyNote, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch, ApiError } from '@/lib/api';
import type { Nota } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { DesenhoDialog } from '@/components/desenho-dialog';

// Bloco de anotações geral, sem vínculo com captação nenhuma (pedido
// 08/10/2026, mesmo dia do painel de notas por captação — ver
// components/notas-painel.tsx, que fala com /captacoes/:id/notas em vez
// de /notas). Mesmo backend (Nota.captacaoId null aqui).
export default function AnotacoesPage() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [selecionadaId, setSelecionadaId] = useState<number | null>(null);
  const [tituloDraft, setTituloDraft] = useState('');
  const [textoDraft, setTextoDraft] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [desenhando, setDesenhando] = useState(false);
  const [busca, setBusca] = useState('');
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const selecionada = notas.find((n) => n.id === selecionadaId) ?? null;

  async function carregar() {
    setLoading(true);
    setErro('');
    try {
      const lista = await apiFetch<Nota[]>('/notas');
      setNotas(lista);
      setSelecionadaId((atual) => (atual && lista.some((n) => n.id === atual) ? atual : (lista[0]?.id ?? null)));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro ao carregar anotações');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega do servidor na montagem
    void carregar();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o rascunho com a nota selecionada (troca de nota, não digitação)
    setTituloDraft(selecionada?.titulo ?? '');
    setTextoDraft(selecionada?.texto ?? '');
  }, [selecionada?.id, selecionada?.titulo, selecionada?.texto]);

  async function novaNota() {
    setSalvando(true);
    try {
      const nota = await apiFetch<Nota>('/notas', { method: 'POST', body: JSON.stringify({}) });
      setNotas((ns) => [nota, ...ns]);
      setSelecionadaId(nota.id);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro ao criar nota');
    } finally {
      setSalvando(false);
    }
  }

  async function salvar() {
    if (!selecionada) return;
    setSalvando(true);
    try {
      const atualizada = await apiFetch<Nota>(`/notas/${selecionada.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ titulo: tituloDraft, texto: textoDraft }),
      });
      setNotas((ns) => ns.map((n) => (n.id === atualizada.id ? atualizada : n)));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro ao salvar nota');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarDesenho(dataUrl: string) {
    if (!selecionada) return;
    setSalvando(true);
    try {
      const atualizada = await apiFetch<Nota>(`/notas/${selecionada.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ desenho: dataUrl }),
      });
      setNotas((ns) => ns.map((n) => (n.id === atualizada.id ? atualizada : n)));
      setDesenhando(false);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro ao salvar o desenho');
    } finally {
      setSalvando(false);
    }
  }


  // Confirmação no AlertDialog (redesign 21/10/2026), não mais confirm().
  async function excluir() {
    if (!selecionada) return;
    setConfirmandoExclusao(false);
    try {
      await apiFetch(`/notas/${selecionada.id}`, { method: 'DELETE' });
      setNotas((ns) => {
        const restantes = ns.filter((n) => n.id !== selecionada.id);
        setSelecionadaId(restantes[0]?.id ?? null);
        return restantes;
      });
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro ao excluir nota');
    }
  }

  const q = busca.trim().toLowerCase();
  const notasVisiveis = q
    ? notas.filter((n) => `${n.titulo ?? ''} ${n.texto ?? ''}`.toLowerCase().includes(q))
    : notas;

  return (
    <div className="mx-auto flex h-full w-full max-w-[1240px] flex-col gap-6 p-6 sm:p-8 lg:px-10">
      <header className="space-y-1.5">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>Gestão</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Anotações</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Anotações</h1>
        <p className="text-sm text-muted-foreground">Soltas, sem vínculo com nenhuma captação.</p>
      </header>

      <div className="grid min-h-[520px] flex-1 gap-6 md:grid-cols-[300px_minmax(0,1fr)]">
        <aside aria-label="Lista de notas" className="flex min-h-0 flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex gap-2">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Buscar notas</span>
              <input
                placeholder="Buscar notas…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <Button size="icon" className="size-10" aria-label="Nova nota" title="Nova nota" onClick={novaNota} disabled={salvando}>
              <Plus />
            </Button>
          </div>
          <span className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {notasVisiveis.length} {notasVisiveis.length === 1 ? 'nota' : 'notas'}
          </span>
          <div className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
            {loading &&
              Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[56px] w-full rounded-lg" />)}
            {!loading &&
              notasVisiveis.map((n) => {
                const ativa = n.id === selecionadaId;
                return (
                  <button
                    key={n.id}
                    type="button"
                    aria-current={ativa || undefined}
                    onClick={() => setSelecionadaId(n.id)}
                    className={cn(
                      'block w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                      ativa ? 'bg-accent' : 'hover:bg-muted',
                    )}
                  >
                    <span className={cn('block truncate text-sm font-semibold', ativa && 'text-accent-foreground')}>
                      {n.titulo || 'Nova nota'}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{n.texto || 'sem texto'}</span>
                  </button>
                );
              })}
            {!loading && notas.length === 0 && (
              <p className="px-2 py-2 text-sm text-muted-foreground">Nenhuma anotação ainda.</p>
            )}
            {!loading && notas.length > 0 && notasVisiveis.length === 0 && (
              <p className="px-2 py-2 text-sm text-muted-foreground">Nenhuma nota com essa busca.</p>
            )}
          </div>
        </aside>

        <section aria-label="Editor de nota" className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
          {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
          {selecionada ? (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b pb-4">
                <label htmlFor="nota-titulo" className="sr-only">
                  Título da nota
                </label>
                <input
                  id="nota-titulo"
                  value={tituloDraft}
                  onChange={(e) => setTituloDraft(e.target.value)}
                  onBlur={salvar}
                  placeholder="Nome da nota"
                  className="min-w-0 flex-1 bg-transparent text-[24px] font-semibold tracking-[-0.01em] outline-none placeholder:text-muted-foreground"
                />
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" className="h-9" onClick={() => setDesenhando(true)}>
                    <PencilRuler />
                    {selecionada.desenho ? 'Editar desenho' : 'Abrir quadro'}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-9 text-destructive hover:bg-accent hover:text-destructive"
                    onClick={() => setConfirmandoExclusao(true)}
                  >
                    <Trash2 />
                    Excluir nota
                  </Button>
                </div>
              </div>
              {selecionada.desenho && (
                <button
                  type="button"
                  onClick={() => setDesenhando(true)}
                  className="self-start overflow-hidden rounded-lg border hover:ring-3 hover:ring-ring/30"
                  title="Abrir desenho"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL (base64), next/image não serve pra isso */}
                  <img src={selecionada.desenho} alt="Desenho da nota" className="h-[72px]" />
                </button>
              )}
              <label htmlFor="nota-texto" className="sr-only">
                Conteúdo da nota
              </label>
              <textarea
                id="nota-texto"
                value={textoDraft}
                onChange={(e) => setTextoDraft(e.target.value)}
                onBlur={salvar}
                placeholder="Escreva aqui..."
                className="min-h-[300px] flex-1 resize-none rounded-lg border border-input bg-transparent p-4 text-[15px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn('size-1.5 rounded-full', salvando ? 'bg-warning' : 'bg-success')} aria-hidden="true" />
                  {salvando ? 'Salvando…' : 'Salva ao sair do campo.'}
                </span>
                <span className="tabular-nums">{textoDraft.length} caracteres</span>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
                <StickyNote className="size-5" aria-hidden="true" />
              </span>
              <p className="text-sm text-muted-foreground">{loading ? 'Carregando…' : 'Crie uma nota pra começar.'}</p>
            </div>
          )}
        </section>
      </div>

      <AlertDialog open={confirmandoExclusao} onOpenChange={setConfirmandoExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a nota &quot;{selecionada?.titulo || 'Nova nota'}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={excluir}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {desenhando && selecionada && (
        <DesenhoDialog valorInicial={selecionada.desenho} onSalvar={salvarDesenho} onFechar={() => setDesenhando(false)} />
      )}
    </div>
  );
}
