'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Par de ícones editar/excluir padrão pra qualquer tabela da aplicação.
// Ver conversa de 11/09/2026: extraído daqui em vez de repetir o mesmo par
// de <Button> em cada página com pequenas diferenças de classe.
export function RowActions({
  onEdit,
  onDelete,
  editTitle = 'Editar',
  deleteTitle = 'Excluir',
  nome,
}: {
  onEdit: () => void;
  onDelete: () => void;
  editTitle?: string;
  deleteTitle?: string;
  nome?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-9 text-muted-foreground hover:text-foreground"
        title={editTitle}
        aria-label={nome ? `${editTitle} ${nome}` : editTitle}
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 text-destructive hover:bg-accent hover:text-destructive"
        title={deleteTitle}
        aria-label={nome ? `${deleteTitle} ${nome}` : deleteTitle}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
