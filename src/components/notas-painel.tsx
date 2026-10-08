'use client';

import { useEffect, useState } from 'react';
import { StickyNote, X } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import type { Nota } from '@/lib/types';

// Bloco de anotações da captação (pedido 08/10/2026): várias notas, cada
// uma com nome próprio — "criar nota, dar nome, ai tudo que eu fizer fica
// naquela nota... crio a nota 2 pra outro assunto". Painel lateral, só
// aparece em modo edição (precisa de captacaoId já salvo — não dá pra
// anexar nota numa captação que ainda não existe no banco).
// Anexo de arquivo e desenho ficam pra depois — precisam de bucket de
// armazenamento, decisão de infra separada.
export function NotasPainel({ captacaoId }: { captacaoId: number }) {
  const [aberto, setAberto] = useState(false);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [selecionadaId, setSelecionadaId] = useState<number | null>(null);
  const [tituloDraft, setTituloDraft] = useState('');
  const [textoDraft, setTextoDraft] = useState('');
  const [salvando, setSalvando] = useState(false);

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

  async function excluir() {
    if (!selecionada) return;
    if (!confirm(`Excluir a nota "${selecionada.titulo}"?`)) return;
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

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="vt-glass-strong inline-flex items-center gap-1.5 rounded-[11px] border border-[var(--vt-line)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--vt-ink)] shadow-[var(--vt-sh)] transition hover:-translate-y-px"
      >
        <StickyNote size={15} />
        Notas{notas.length > 0 ? ` (${notas.length})` : ''}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setAberto(false)}>
          <div
            className="flex h-full w-full max-w-[760px] bg-[var(--vt-surface)]"
            style={{ color: 'var(--vt-ink)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* lista de notas */}
            <aside className="flex w-[240px] shrink-0 flex-col gap-1 border-r p-3" style={{ borderColor: 'var(--vt-line)' }}>
              <button
                type="button"
                onClick={novaNota}
                disabled={salvando}
                className="mb-2 flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-dashed text-[12.5px] font-bold disabled:opacity-50"
                style={{ borderColor: 'var(--vt-line)', color: 'var(--vt-red)' }}
              >
                + Nova nota
              </button>
              <div className="flex-1 space-y-1 overflow-y-auto">
                {notas.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelecionadaId(n.id)}
                    className="block w-full rounded-[10px] px-2.5 py-2 text-left"
                    style={{ background: n.id === selecionadaId ? 'var(--vt-bg-prej)' : 'transparent' }}
                  >
                    <p
                      className="truncate text-[13px] font-bold"
                      style={{ color: n.id === selecionadaId ? 'var(--vt-red)' : 'var(--vt-ink)' }}
                    >
                      {n.titulo || 'Nova nota'}
                    </p>
                    <p className="truncate text-[11px]" style={{ color: 'var(--vt-muted)' }}>
                      {n.texto || 'sem texto'}
                    </p>
                  </button>
                ))}
                {!carregando && notas.length === 0 && (
                  <p className="px-2.5 py-2 text-[12px]" style={{ color: 'var(--vt-muted)' }}>
                    Nenhuma nota ainda.
                  </p>
                )}
              </div>
            </aside>

            {/* nota aberta */}
            <section className="flex flex-1 flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-bold">Notas</h2>
                <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="rounded-[8px] p-1.5 hover:bg-black/5">
                  <X size={18} />
                </button>
              </div>

              {erro && (
                <p className="text-[12.5px] font-semibold" style={{ color: 'var(--vt-c-prej)' }}>
                  {erro}
                </p>
              )}

              {selecionada ? (
                <div className="flex flex-1 flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      value={tituloDraft}
                      onChange={(e) => setTituloDraft(e.target.value)}
                      onBlur={salvar}
                      placeholder="Nome da nota"
                      className="flex-1 border-b bg-transparent pb-1 text-[18px] font-extrabold outline-none"
                      style={{ borderColor: 'transparent' }}
                    />
                    <button type="button" onClick={excluir} className="text-[11.5px] font-bold" style={{ color: 'var(--vt-red)' }}>
                      Excluir nota
                    </button>
                  </div>
                  <textarea
                    value={textoDraft}
                    onChange={(e) => setTextoDraft(e.target.value)}
                    onBlur={salvar}
                    placeholder="Escreva aqui..."
                    className="min-h-[200px] flex-1 resize-none rounded-[10px] border p-3.5 text-[14px] outline-none"
                    style={{ borderColor: 'var(--vt-line)' }}
                  />
                  <p className="text-[11px]" style={{ color: 'var(--vt-muted)' }}>
                    {salvando ? 'Salvando…' : 'Salva ao sair do campo.'}
                  </p>
                </div>
              ) : (
                <p className="text-[13px]" style={{ color: 'var(--vt-muted)' }}>
                  {carregando ? 'Carregando…' : 'Crie uma nota pra começar.'}
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
