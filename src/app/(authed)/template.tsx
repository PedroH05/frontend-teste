import { ViewTransition } from 'react';

// Transição entre telas (pedido 24/11/2026): o template é recriado a cada
// navegação (o layout não), então o <ViewTransition> daqui dispara saída
// da tela velha e entrada da nova. Só o conteúdo anima; a barra lateral
// está no layout (AppShell), fora daqui, e fica parada.
//
// Direção vem do `transitionTypes` do link (ver lib/transicao.ts). Sem
// tipo (voltar do navegador, link que não passou por `tipoTransicao`) só
// esmaece, sem deslizar. CSS em globals.css (`::view-transition-*`).
const ANIMACAO = {
  'nav-forward': 'nav-forward',
  'nav-back': 'nav-back',
  default: 'nav-fade',
};

export default function AuthedTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={ANIMACAO} exit={ANIMACAO} default="none">
      {children}
    </ViewTransition>
  );
}
