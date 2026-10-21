'use client';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Ações de linha padrão pra qualquer tabela da aplicação (conversa de
// 11/09/2026). Desde 21/10/2026 é um menu "⋯" com Editar e Excluir dentro,
// no lugar do par de ícones solto (pedido direto).
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
    <div className="flex justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-foreground"
              aria-label={nome ? `Ações de ${nome}` : 'Ações'}
              title="Ações"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[150px]">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            {editTitle}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 />
            {deleteTitle}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
