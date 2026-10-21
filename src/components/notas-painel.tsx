'use client';

import { useEffect, useState } from 'react';
import { PencilRuler, Plus, StickyNote, Trash2, X } from 'lucide-react';
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
import { DesenhoDialog } from '@/components/desenho-dialog';

// Bloco de anotações da captação (pedido 08/10/2026): várias notas, cada
// uma com nome próprio — "criar nota, dar nome, ai tudo que eu fizer fica
// naquela nota... crio a nota 2 pra outro assunto". Painel lateral, só
// aparece em modo edição (precisa de captacaoId já salvo — não dá pra
// anexar nota numa captação que ainda não existe no banco).
// Desenho usa Excalidraw (ver desenho-dialog.tsx), exportado como PNG
// base64, sem bucket de armazenamento. Anexo de arquivo de verdade (foto,
// PDF) continua pra depois — esse sim precisa de bucket.
export function NotasPainel({ captacaoId }: { captacaoId: number }) {
  const [aberto, setAberto] = useState(false);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [selecionadaId, setSelecionadaId] = useState<number | null>(null);
  const [tituloDraft, setTituloDraft] = useState('');
  const [textoDraft, setTextoDraft] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [desenhando, setDesenhando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const selecionada = notas.find((n) => n.id === selecionadaId) ?? null;

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const lista = await apiFetch<Nota[]>(`/captacoes/${captacaoId}/notas`);
      setNotas(lista);
      if (lista.length > 0 && !lista.some((n) => n.id === selecionadaId)) {
        setSelecionadaId(lista[0].id);
      }
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro ao carregar notas');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega do servidor ao abrir, não é estado derivado de render
    if (aberto) void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir, não a cada render
  }, [aberto]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o rascunho com a nota selecionada (troca de nota, não digitação)
    setTituloDraft(selecionada?.titulo ?? '');
    setTextoDraft(selecionada?.texto ?? '');
  }, [selecionada?.id, selecionada?.titulo, selecionada?.texto]);

  async function novaNota() {
    setSalvando(true);
    try {
      const nota = await apiFetch<Nota>(`/captacoes/${captacaoId}/notas`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
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

  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !desenhando && !confirmandoExclusao) setAberto(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aberto, desenhando, confirmandoExclusao]);

  return (
    <>
      <Button variant="outline" className="h-10 px-3.5" onClick={() => setAberto(true)}>
        <StickyNote />
        Notas{notas.length > 0 ? ` (${notas.length})` : ''}
      </Button>

      {aberto && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-[2px]"
          onClick={() => setAberto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Notas da captação"
            className="vt-dash-up flex h-full w-full max-w-[780px] bg-background text-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <aside className="flex w-[250px] shrink-0 flex-col gap-3 border-r bg-card p-3">
              <div className="flex items-center gap-2 px-1 pt-1">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
                  <StickyNote className="size-4" aria-hidden="true" />
                </span>
                <span className="text-[15px] font-semibold">Notas</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{notas.length}</span>
              </div>
              <Button onClick={novaNota} disabled={salvando} className="h-9">
                <Plus />
                Nova nota
              </Button>
              <div className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
                {carregando &&
                  Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[52px] w-full rounded-lg" />)}
                {!carregando &&
                  notas.map((n) => {
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
                {!carregando && notas.length === 0 && (
                  <p className="px-2 py-2 text-sm text-muted-foreground">Nenhuma nota ainda.</p>
                )}
              </div>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col gap-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold tracking-wider text-primary uppercase">Nota da captação</span>
                <Button variant="ghost" size="icon" className="size-9" onClick={() => setAberto(false)} aria-label="Fechar">
                  <X />
                </Button>
              </div>

              {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}

              {selecionada ? (
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-3 border-b pb-4">
                    <input
                      value={tituloDraft}
                      onChange={(e) => setTituloDraft(e.target.value)}
                      onBlur={salvar}
                      placeholder="Nome da nota"
                      aria-label="Título da nota"
                      className="min-w-0 flex-1 bg-transparent text-[22px] font-semibold tracking-[-0.01em] outline-none placeholder:text-muted-foreground"
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
                      <img src={selecionada.desenho} alt="Desenho da nota" className="h-[64px]" />
                    </button>
                  )}
                  <textarea
                    value={textoDraft}
                    onChange={(e) => setTextoDraft(e.target.value)}
                    onBlur={salvar}
                    placeholder="Escreva aqui..."
                    aria-label="Conteúdo da nota"
                    className="min-h-[200px] flex-1 resize-none rounded-lg border border-input bg-transparent p-4 text-[15px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('size-1.5 rounded-full', salvando ? 'bg-warning' : 'bg-success')} aria-hidden="true" />
                      {salvando ? 'Salvando…' : 'Salva ao sair do campo.'}
                    </span>
                    <span className="tabular-nums">{textoDraft.length} caracteres</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
                    <StickyNote className="size-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm text-muted-foreground">{carregando ? 'Carregando…' : 'Crie uma nota pra começar.'}</p>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

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
    </>
  );
}
