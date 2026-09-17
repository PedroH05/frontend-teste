// Formatação de data compartilhada — extraído de historico/page.tsx em
// 17/09/2026 pra reaproveitar na Carteira (createdAt) sem duplicar a
// mesma lógica em dois lugares.

export function formatDataHora(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

export function formatData(v: string | null): string {
  if (!v) return '—';
  return v.slice(0, 10).split('-').reverse().join('/');
}
