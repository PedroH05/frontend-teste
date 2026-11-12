// Busca tolerante a texto colado (e-mail, Excel, PDF, pasta). Esse texto
// costuma vir com espaço não separável (NBSP), caractere invisível
// (zero-width), quebra de linha, espaço duplo ou acento diferente — nada
// disso aparece pro usuário, mas fazia o `includes` puro não achar a
// referência que está bem ali na tela.

const INVISIVEIS = /[​-‍⁠﻿­]/g;

// Campos que nunca entram na busca: datas/horários e ids internos. Sem isso
// uma referência numérica curta ("2611") casava com "2026-11-12".
const IGNORADOS = new Set([
  'id',
  'capId',
  'stage',
  'createdAt',
  'updatedAt',
  'efetivadaEm',
  'docRecebidaEm',
  'dateLabel',
]);

// Só nestes campos vale a comparação "compacta" (ignora -, /, espaço):
// "ABC-123" acha "ABC 123". São códigos, onde o separador varia conforme
// quem digitou. Em texto livre (cliente, observação) seria ruído.
const IDENTIFICADORES = new Set(['referencia', 'ref', 'bl', 'ce', 'container', 'cont', 'cnpj']);

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

type Valor = { texto: string; identificador: boolean };

function coletar(obj: unknown, chave = ''): Valor[] {
  if (obj == null || IGNORADOS.has(chave)) return [];
  if (typeof obj === 'string') return [{ texto: obj, identificador: IDENTIFICADORES.has(chave) }];
  if (typeof obj === 'number') return [{ texto: String(obj), identificador: false }];
  if (typeof obj !== 'object') return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => coletar(v, k));
}

/** Prepara a consulta uma vez (fora do filter) e devolve o teste por registro. */
export function criarFiltroBusca(consulta: string): ((registro: unknown) => boolean) | null {
  const q = normalizarBusca(consulta);
  if (!q) return null;
  const qc = compacto(q);
  return (registro) =>
    coletar(registro).some(({ texto, identificador }) => {
      const n = normalizarBusca(texto);
      return n.includes(q) || (identificador && qc.length >= 3 && compacto(n).includes(qc));
    });
}
