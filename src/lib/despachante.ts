// Mesma normalização do original (cleanDesp em index.html): maiúsculo, trim,
// e descarta se for só dígito (valor claramente errado digitado no campo).
export function cleanDesp(v: string): string {
  const s = v.trim().toUpperCase();
  return /^\d+$/.test(s) ? '' : s;
}
