// Busca tolerante a texto colado (e-mail, Excel, PDF, pasta). Esse texto
// costuma vir com espaço não separável (NBSP), caractere invisível
// (zero-width), quebra de linha, espaço duplo ou acento diferente — nada
// disso aparece pro usuário, mas fazia o `includes` puro não achar a
// referência que está bem ali na tela.

const INVISIVEIS = /[​-‍⁠﻿­]/g;

/** minúsculas, sem acento, sem invisíveis, espaços (inclui NBSP/tab/\n) colapsados. */
export function normalizarBusca(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(INVISIVEIS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** só letras e números — "REF-123", "ref 123" e "REF/123" viram "ref123". */
function compacto(s: string): string {
  return s.replace(/[^a-z0-9]/g, '');
}

function valoresTexto(obj: unknown): string[] {
  if (obj == null) return [];
  if (typeof obj === 'string') return [obj];
  if (typeof obj === 'number') return [String(obj)];
  if (typeof obj !== 'object') return [];
  return Object.values(obj as Record<string, unknown>).flatMap(valoresTexto);
}

/** Prepara a consulta uma vez (fora do filter) e devolve o teste por registro. */
export function criarFiltroBusca(consulta: string): ((registro: unknown) => boolean) | null {
  const q = normalizarBusca(consulta);
  if (!q) return null;
  const qc = compacto(q);
  return (registro) =>
    valoresTexto(registro).some((v) => {
      const n = normalizarBusca(v);
      return n.includes(q) || (qc.length >= 3 && compacto(n).includes(qc));
    });
}
