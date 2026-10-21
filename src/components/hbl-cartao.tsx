'use client';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { listaConts } from '@/lib/conteineres';

// HBL: se tiver um só, mostra normal. Se tiver mais de um, mostra o primeiro
// com a bolinha +N e, com mouse por cima, a lista completa.
export function HblCartao({ valor }: { valor: string | null | undefined }) {
  const lista = listaConts(valor);
  if (lista.length === 0) return <span>—</span>;
  if (lista.length === 1) return <span className="font-mono">{lista[0]}</span>;

  return (
    <HoverCard>
      <HoverCardTrigger className="inline-flex cursor-default items-center whitespace-nowrap font-mono">
        {lista[0]}
        <span
          className="ml-1.5 rounded-full bg-warning-soft px-1.5 text-[10px] font-bold text-warning-text"
        >
          +{lista.length - 1}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto min-w-[160px] flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {lista.length} HBLs
        </p>
        {lista.map((h, i) => (
          <p key={`${h}-${i}`} className="font-mono text-[12px]">
            {h}
          </p>
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}
