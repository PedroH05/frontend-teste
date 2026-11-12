// Busca tolerante a texto colado (e-mail, Excel, PDF, pasta). Esse texto
// costuma vir com espaço não separável (NBSP), caractere invisível
// (zero-width), quebra de linha, espaço duplo, acento diferente ou um
// prefixo ("Ref.: ", "Nossa ref.") — nada disso aparece pro usuário, mas
// fazia o `includes` puro não achar a referência que está bem ali na tela.
//
// Um registro casa se QUALQUER uma vale:
//  1. a consulta inteira aparece num campo (como sempre foi);
//  2. só em código (referência, BL, CE, contêiner, CNPJ): a consulta sem
//     separadores aparece no campo sem separadores ("ABC-123" ≈ "abc 123");
//  3. busca por palavras: TODAS as palavras da consulta (tirando prefixos
//     tipo "ref"/"processo" e palavras de 1 letra) aparecem, cada uma em
//     algum campo, em qualquer ordem.

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

// Só nestes campos vale a comparação "compacta" (ignora -, /, espaço). São
// códigos, onde o separador varia conforme quem digitou. Em texto livre
// (cliente, observação) seria ruído.
const IDENTIFICADORES = new Set(['referencia', 'ref', 'bl', 'ce', 'container', 'cont', 'cnpj']);

// Palavras que vêm coladas junto da referência no e-mail e não são parte dela.
const PALAVRAS_IGNORADAS = new Set([
  'ref',
  'refs',
  'referencia',
  'nossa',
  'nosso',
  'sua',
  'seu',
  'processo',
  'proc',
  'nr',
  'num',
  'numero',
  'no',
  'de',
  'da',
  'do',
]);

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

/** Palavras significativas da consulta (já normalizada). */
function palavras(q: string): string[] {
  return q
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 2 && !PALAVRAS_IGNORADAS.has(p));
}

type Valor = { texto: string; identificador: boolean };

function coletar(obj: unknown, chave = ''): Valor[] {
  if (obj == null || IGNORADOS.has(chave)) return [];
  if (typeof obj === 'string') return [{ texto: normalizarBusca(obj), identificador: IDENTIFICADORES.has(chave) }];
  if (typeof obj === 'number') return [{ texto: String(obj), identificador: false }];
  if (typeof obj !== 'object') return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => coletar(v, k));
}

/**
 * O que foi buscado, pra mostrar no aviso de "nenhum resultado": sem
 * invisíveis e com espaços colapsados, mas na caixa original. Vazio = não há busca.
 */
export function textoBuscado(consulta: string): string {
  return consulta.replace(INVISIVEIS, '').replace(/\s+/g, ' ').trim();
}

export const DICA_SEM_RESULTADO =
  'Confira se está igual ao cadastrado, ou busque só por um pedaço (ex.: o número da referência).';

/** Prepara a consulta uma vez (fora do filter) e devolve o teste por registro. */
export function criarFiltroBusca(consulta: string): ((registro: unknown) => boolean) | null {
  const q = normalizarBusca(consulta);
  if (!q) return null;
  const ps = palavras(q);
  // Sem os prefixos: "Ref.: ABC123" compara "abc123" com o código compacto.
  const qc = ps.length ? ps.join('') : compacto(q);
  return (registro) => {
    const valores = coletar(registro);
    const inteira = valores.some(
      ({ texto, identificador }) =>
        texto.includes(q) || (identificador && qc.length >= 3 && compacto(texto).includes(qc)),
    );
    if (inteira) return true;
    return ps.length > 0 && ps.every((p) => valores.some(({ texto }) => texto.includes(p)));
  };
}
