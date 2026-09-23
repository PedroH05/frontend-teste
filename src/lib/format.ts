// Formatação de data compartilhada — extraído de historico/page.tsx em
// 17/09/2026 pra reaproveitar na Carteira (createdAt) sem duplicar a
// mesma lógica em dois lugares.

export function formatDataHora(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  // toLocaleString('pt-BR') separa data e hora com vírgula (ex.: "18/09/2026,
  // 14:30") — trocado por hífen a pedido (23/09/2026).
  return d
    .toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', ' -');
}

export function formatData(v: string | null): string {
  if (!v) return '—';
  return v.slice(0, 10).split('-').reverse().join('/');
}
