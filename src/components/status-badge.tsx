import { AlertCircle, CalendarDays, CheckCircle2, Clock, Flag, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Banda } from '@/lib/risco';

// Badge de status das tabelas (redesign, HANDOFF seção 3 "Status"). Com a
// opção "Mostrar o nome do status" desligada na Config, o CSS de
// globals.css (`data-status-texto`) esconde o texto e deixa só o ícone num
// quadradinho — o nome continua no `title`/`aria-label`.
export const STATUS_ESTILO: Record<Banda['k'], { cls: string; Icon: typeof Clock }> = {
  prej: { cls: 'bg-accent text-primary', Icon: AlertCircle },
  jan: { cls: 'bg-warning-soft text-warning-text', Icon: Clock },
  and: { cls: 'bg-warning-soft text-warning-text', Icon: RefreshCw },
  efet: { cls: 'bg-success-soft text-success-text', Icon: CheckCircle2 },
  conc: { cls: 'bg-success-soft text-success-text', Icon: Flag },
  prog: { cls: 'bg-muted text-muted-foreground', Icon: CalendarDays },
};

export function StatusBadge({ k, label, className }: { k: Banda['k']; label: string; className?: string }) {
  const { cls, Icon } = STATUS_ESTILO[k];
  return (
    <span
      data-slot="status-badge"
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap',
        cls,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="vt-band-texto">{label}</span>
    </span>
  );
}
