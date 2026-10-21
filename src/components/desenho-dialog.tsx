'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState, BinaryFileData } from '@excalidraw/excalidraw/types';
import type { FileId } from '@excalidraw/excalidraw/element/types';
import { PencilRuler, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

import '@excalidraw/excalidraw/index.css';

// Excalidraw usa `window`/canvas — não existe no servidor (Next.js SSR).
const Excalidraw = dynamic(async () => (await import('@excalidraw/excalidraw')).Excalidraw, {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quadro de desenho"
        className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
              <PencilRuler className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Desenhar</h2>
              <p className="text-xs text-muted-foreground">O desenho fica salvo como imagem na nota.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={salvar} disabled={salvando} className="h-9 px-4">
              {salvando ? 'Salvando…' : 'Salvar no anexo'}
            </Button>
            <Button variant="ghost" size="icon" className="size-9" onClick={onFechar} aria-label="Fechar">
              <X />
            </Button>
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
