'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

// Transição entre telas (pedido 24/11/2026). Antes ficava em
// app/(authed)/template.tsx, mas o voltar/avançar do navegador não animava:
// o Next guarda a tela visitada escondida num <Activity> e, no voltar, só
// mostra de novo, sem recriar o template, então não havia "entrada" pro
// <ViewTransition>. Com `key={pathname}` aqui, toda troca de tela (link,
// router.push ou voltar/avançar) sai e entra de novo, e anima.
//
// Direção: `transitionTypes` do link (lib/transicao.ts). Sem tipo
// (voltar/avançar), `nav-auto` com o lado vindo de `data-nav-dir`, que o
// AppShell grava no <html> no popstate. CSS em globals.css.
const ANIMACAO = {
  'nav-forward': 'nav-forward',
  'nav-back': 'nav-back',
  default: 'nav-auto',
};

// No Vitest o `react` é o estável, sem ViewTransition (o Next usa o canary
// embutido); aí a tela só renderiza sem animação.
const ViewTransition = (React as { ViewTransition?: typeof React.ViewTransition }).ViewTransition;

export function TransicaoTela({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!ViewTransition) return <>{children}</>;
  return (
    <ViewTransition key={pathname} enter={ANIMACAO} exit={ANIMACAO} default="none">
      {children}
    </ViewTransition>
  );
}
