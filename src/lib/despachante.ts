// Mesma normalização do original (cleanDesp em index.html): maiúsculo, trim,
// e descarta se for só dígito (valor claramente errado digitado no campo).
export function cleanDesp(v: string): string {
  const s = v.trim().toUpperCase();
  return /^\d+$/.test(s) ? '' : s;
}

// Opções padrão do select de despachante no sistema antigo (`<select id="m-desp">`
// em index.html) — a migração tinha virado campo de texto livre, perdendo essa
// lista. Restaurado 22/09/2026, com "+ novo despachante" cobrindo qualquer nome
// fora dela (mesmo comportamento do original).
export const DESPACHANTES_PADRAO = ['LOGMAIS', 'NIRRON', 'ATHENA', 'AUDAZ'];
