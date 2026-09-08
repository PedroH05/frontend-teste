// Separa uma string de BL em múltiplos códigos — mesmos separadores do
// original (vírgula, ponto e vírgula, barra ou quebra de linha).
export function splitBls(v: string | null | undefined): string[] {
  return (v ?? '')
    .split(/[,;/\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
