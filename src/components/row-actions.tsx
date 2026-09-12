'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Par de ícones editar/excluir padrão pra qualquer tabela da aplicação —
// mesma cor/tamanho em Carteira, Histórico e Clientes. Ver conversa de
// 11/09/2026: extraído daqui em vez de repetir o mesmo par de <Button> em
// cada página com pequenas diferenças de classe.
export function RowActions({
  onEdit,
  onDelete,
  editTitle = 'Editar',
  deleteTitle = 'Excluir',
}: {
  onEdit: () => void;
  onDelete: () => void;
  editTitle?: string;
  deleteTitle?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button variant="ghost" size="icon-sm" title={editTitle} style={{ color: 'var(--vt-muted)' }} onClick={onEdit}>
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon-sm" title={deleteTitle} style={{ color: 'var(--vt-c-prej)' }} onClick={onDelete}>
        <Trash2 />
      </Button>
    </div>
  );
}
