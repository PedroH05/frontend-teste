// Contêineres vêm numa string só (podem vir separados por vírgula/espaço).
export function listaConts(v: string | null | undefined): string[] {
  return (v ?? '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
}
