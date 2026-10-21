'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Páginas visíveis: primeira, última, a atual e uma de cada lado; o resto
// vira "…". Ex.: 1 … 4 5 6 … 74.
export function paginasVisiveis(atual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, atual - 1, atual, atual + 1]);
  if (atual <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (atual >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

// Paginação numerada (pedido 21/10/2026, item da seção 6 do HANDOFF) —
// usada em Carteira, Histórico e Clientes.
export function Paginacao({
  pagina,
  totalPaginas,
  onChange,
}: {
  pagina: number;
  totalPaginas: number;
  onChange: (p: number) => void;
}) {
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center gap-1">
      <Button variant="outline" className="h-9 px-3" disabled={pagina <= 1} onClick={() => onChange(pagina - 1)}>
        <ChevronLeft />
        Anterior
      </Button>
      {paginasVisiveis(pagina, totalPaginas).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-1.5 text-muted-foreground" aria-hidden="true">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant="ghost"
            aria-label={`Página ${p}`}
            aria-current={p === pagina ? 'page' : undefined}
            onClick={() => onChange(p)}
            className={cn(
              'size-9 p-0 tabular-nums',
              p === pagina && 'border border-foreground font-semibold hover:bg-transparent',
            )}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        className="h-9 px-3"
        disabled={pagina >= totalPaginas}
        onClick={() => onChange(pagina + 1)}
      >
        Próxima
        <ChevronRight />
      </Button>
    </nav>
  );
}
