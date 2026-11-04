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

// Data que a Carteira e o Histórico mostram (e usam pra ordenar/filtrar) no
// campo "Registrado em": pendente = quando foi salva; efetivada = quando foi
// efetivada (pedido 04/11/2026). Captação efetivada antes disso não tem
// `efetivadaEm` e continua mostrando a data de criação, como sempre.
export function dataDoProcesso(c: { efetivadaEm?: string | null; createdAt: string | null }): string | null {
  return c.efetivadaEm ?? c.createdAt;
}

// Só a data, no fuso local — pra instante exato (efetivadaEm). `formatData`
// corta o texto ISO em UTC, e depois das 21h no Brasil cairia no dia seguinte.
export function formatDataLocal(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}
