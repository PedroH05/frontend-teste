'use client';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { listaConts } from '@/lib/conteineres';

// Mostra o primeiro contêiner e, com mouse por cima, um cartão com a lista
// completa — sem precisar abrir a captação pra ver.
export function ListaConteineres({ valor }: { valor: string | null | undefined }) {
  const lista = listaConts(valor);
  if (lista.length === 0) return <span>—</span>;
  if (lista.length === 1) return <span className="font-mono">{lista[0]}</span>;

  return (
    <HoverCard>
      <HoverCardTrigger className="inline-flex cursor-default items-center whitespace-nowrap font-mono">
        {lista[0]}
        <span
          className="ml-1.5 rounded-full px-1.5 text-[10px] font-bold"
          style={{ background: 'var(--vt-bg-jan)', color: 'var(--vt-c-jan)' }}
        >
          +{lista.length - 1}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto min-w-[180px] flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {lista.length} contêineres
        </p>
        {lista.map((c, i) => (
          <p key={`${c}-${i}`} className="font-mono text-[12px]">
            {c}
          </p>
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}
