'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState, BinaryFileData } from '@excalidraw/excalidraw/types';
import type { FileId } from '@excalidraw/excalidraw/element/types';
import { X } from 'lucide-react';

import '@excalidraw/excalidraw/index.css';

// Excalidraw usa `window`/canvas — não existe no servidor (Next.js SSR).
const Excalidraw = dynamic(async () => (await import('@excalidraw/excalidraw')).Excalidraw, {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-[13px]" style={{ color: 'var(--vt-muted)' }}>
      Carregando o quadro…
    </div>
  ),
});

// Carrega o PNG salvo como uma imagem dentro da cena do Excalidraw, pra
// quem reabrir ver o desenho de antes (e poder desenhar por cima) — antes
// o quadro sempre abria em branco, só a miniatura mostrava o resultado.
// Não é a cena editável original (só salvamos o PNG final, não os traços),
// então o que volta é a imagem, não os elementos individuais.
async function cenaComImagem(dataUrl: string): Promise<ExcalidrawInitialDataState> {
  const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
  const tamanho = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
    img.onerror = () => resolve({ width: 400, height: 300 });
    img.src = dataUrl;
  });
  // Cabe numa área razoável do quadro sem distorcer a proporção.
  const maxLado = 600;
  const escala = Math.min(1, maxLado / Math.max(tamanho.width, tamanho.height));
  const largura = tamanho.width * escala;
  const altura = tamanho.height * escala;

  const fileId = `desenho-salvo-${Date.now()}` as FileId;
  const elements = convertToExcalidrawElements([
    {
      type: 'image',
      fileId,
      x: 0,
      y: 0,
      width: largura,
      height: altura,
    },
  ]);
  const files: Record<string, BinaryFileData> = {
    [fileId]: {
      mimeType: 'image/png',
      id: fileId,
      dataURL: dataUrl as BinaryFileData['dataURL'],
      created: Date.now(),
    },
  };
  return { elements, files, appState: { viewBackgroundColor: '#ffffff' } };
}

// Desenho da nota (pedido 08/10/2026 — "usa o excalidraw"): quadro de
// verdade, não inventado. Exporta a cena como PNG e devolve em base64 —
// sem bucket de armazenamento, fica direto no campo `desenho` da nota.
export function DesenhoDialog({
  valorInicial,
  onSalvar,
  onFechar,
}: {
  valorInicial: string | null;
  onSalvar: (dataUrl: string) => void;
  onFechar: () => void;
}) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const api = apiRef.current;
    if (!api) return;
    setSalvando(true);
    try {
      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({
        elements: api.getSceneElements(),
        appState: { ...api.getAppState(), exportBackground: true, viewBackgroundColor: '#ffffff' },
        files: api.getFiles(),
        mimeType: 'image/png',
      });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      onSalvar(dataUrl);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
      <div
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-[14px] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--vt-line)' }}>
          <h2 className="text-[14px] font-bold" style={{ color: 'var(--vt-ink)' }}>
            Desenhar
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="vt-btn-primary rounded-[9px] px-4 py-1.5 text-[12.5px] font-bold disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Salvar no anexo'}
            </button>
            <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-[8px] p-1.5 hover:bg-black/5">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1">
          <Excalidraw
            excalidrawAPI={(api) => {
              apiRef.current = api;
            }}
            initialData={valorInicial ? cenaComImagem(valorInicial) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
