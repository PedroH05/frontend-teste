'use client';

import { useEffect, useState } from 'react';
import { PencilRuler } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import type { Nota } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
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
    <div className="flex h-full gap-5 p-6 sm:p-8" style={{ color: 'var(--vt-ink)' }}>
      <aside className="flex w-[260px] shrink-0 flex-col gap-3">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Anotações</h1>
          <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--vt-muted)' }}>
            Soltas, sem vínculo com nenhuma captação.
          </p>
        </div>
        <button
          type="button"
          onClick={novaNota}
          disabled={salvando}
          className="flex h-10 items-center justify-center gap-1.5 rounded-[11px] border border-dashed text-[12.5px] font-bold disabled:opacity-50"
          style={{ borderColor: 'var(--vt-line)', color: 'var(--vt-red)' }}
        >
          + Nova nota
        </button>
        <div className="vt-glass flex-1 space-y-1 overflow-y-auto p-2">
          {loading &&
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="mb-1.5 h-[52px] w-full rounded-[10px]" />)}
          {!loading &&
            notas.map((n) => (
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
          {!loading && notas.length === 0 && (
            <p className="px-2.5 py-2 text-[12px]" style={{ color: 'var(--vt-muted)' }}>
              Nenhuma anotação ainda.
            </p>
          )}
        </div>
      </aside>

      <section className="vt-glass flex flex-1 flex-col gap-3 p-6">
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
                className="flex-1 border-b bg-transparent pb-1 text-[20px] font-extrabold outline-none"
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
              className="min-h-[260px] flex-1 resize-none rounded-[10px] border p-4 text-[14px] outline-none"
              style={{ borderColor: 'var(--vt-line)' }}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDesenhando(true)}
                className="vt-glass-strong inline-flex items-center gap-1.5 rounded-[9px] border border-[var(--vt-line)] px-3 py-1.5 text-[12px] font-semibold"
              >
                <PencilRuler size={14} />
                {selecionada.desenho ? 'Editar desenho' : 'Abrir quadro'}
              </button>
              {selecionada.desenho && (
                // eslint-disable-next-line @next/next/no-img-element -- data URL (base64), next/image não serve pra isso
                <img
                  src={selecionada.desenho}
                  alt="Desenho da nota"
                  className="h-[52px] cursor-pointer rounded-[8px] border"
                  style={{ borderColor: 'var(--vt-line)' }}
                  onClick={() => setDesenhando(true)}
                />
              )}
            </div>
            <p className="text-[11px]" style={{ color: 'var(--vt-muted)' }}>
              {salvando ? 'Salvando…' : 'Salva ao sair do campo.'}
            </p>
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: 'var(--vt-muted)' }}>
            {loading ? 'Carregando…' : 'Crie uma nota pra começar.'}
          </p>
        )}
      </section>

      {desenhando && selecionada && (
        <DesenhoDialog valorInicial={selecionada.desenho} onSalvar={salvarDesenho} onFechar={() => setDesenhando(false)} />
      )}
    </div>
  );
}
