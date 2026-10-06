'use client';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

// HBL cortado na célula; com mouse por cima, o cartão mostra o valor inteiro.
export function HblCartao({ valor }: { valor: string | null | undefined }) {
  if (!valor) return <span>—</span>;

  return (
    <HoverCard>
      <HoverCardTrigger className="block max-w-[130px] cursor-default truncate font-mono">{valor}</HoverCardTrigger>
      <HoverCardContent className="w-auto min-w-[160px]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">HBL</p>
        <p className="font-mono text-[13px]">{valor}</p>
      </HoverCardContent>
    </HoverCard>
  );
}
