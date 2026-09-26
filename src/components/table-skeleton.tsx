import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';

// Linhas-esqueleto pra tabela enquanto os dados carregam — no lugar do
// antigo "Carregando…" numa linha só (pedido 25/09/2026). Cada coluna diz o
// formato do conteúdo real: `pill` (badge), `twoLine` (nome + referência),
// `bar` (texto curto), `none` (coluna vazia, ex.: seta). Larguras variam
// por linha/coluna de forma determinística (nada de Math.random — igual
// no servidor e no cliente, sem erro de hidratação).
export type SkeletonColumn = 'pill' | 'twoLine' | 'bar' | 'none';

const LARGURAS = [64, 88, 72, 104, 80, 96, 68];

export function TableSkeletonRows({
  columns,
  rows = 5,
}: {
  columns: SkeletonColumn[];
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow key={r} data-slot="skeleton-row" style={{ borderColor: 'var(--vt-line)' }}>
          {columns.map((tipo, c) => {
            const w = LARGURAS[(r * 3 + c * 2) % LARGURAS.length];
            return (
              <TableCell key={c} className="h-[58px]">
                {tipo === 'pill' && <Skeleton className="h-[22px] rounded-full" style={{ width: w + 24 }} />}
                {tipo === 'twoLine' && (
                  <div className="grid gap-1.5">
                    <Skeleton className="h-3.5" style={{ width: w + 24 }} />
                    <Skeleton className="h-3" style={{ width: w - 8 }} />
                  </div>
                )}
                {tipo === 'bar' && <Skeleton className="h-3.5" style={{ width: w }} />}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}
