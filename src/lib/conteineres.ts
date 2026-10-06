// Contêineres vêm numa string só, separados por espaço, vírgula, ponto e
// vírgula, barra ou pipe. O hífen não separa: faz parte do código (ex.: MSCU452849-8).
export function listaConts(v: string | null | undefined): string[] {
  return (v ?? '').split(/[\s,;/|]+/).map((s) => s.trim()).filter(Boolean);
}
