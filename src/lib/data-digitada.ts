// Data digitada à mão nos campos de data (pedido 24/11/2026): além de
// escolher no calendário, dá pra digitar "28112026" e as barras entram
// sozinhas, ou colar "28/11/2026" / "28-11-2026" / "2026-11-28" vindo do
// e-mail. Tudo em fuso local, nunca `new Date(iso)` (leria como UTC e
// mostraria o dia anterior no Brasil).

export type LeituraData =
  | { estado: 'vazia' }
  | { estado: 'incompleta' }
  | { estado: 'invalida' }
  | { estado: 'ok'; data: Date };

export const MSG_DATA_INCOMPLETA = 'Data incompleta, use dd/mm/aaaa.';
export const MSG_DATA_INVALIDA = 'Data inválida, confira dia e mês.';

// Máscara dd/mm/aaaa: só dígitos (até 8), barras nas posições certas.
// ISO colado (aaaa-mm-dd) é reordenado antes, senão viraria "20/26/1128".
export function mascaraData(texto: string): string {
  const iso = texto.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  const digitos = iso ? `${iso[3]}${iso[2]}${iso[1]}` : texto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

// Lê "dd/mm/aaaa" ou "dd/mm/aa" (aa vira 20aa). Data impossível (31/02,
// mês 13) é `invalida`, não "rola" pro mês seguinte como o Date faria.
export function lerDataBR(texto: string): LeituraData {
  const t = texto.trim();
  if (!t) return { estado: 'vazia' };
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!m) return { estado: 'incompleta' };
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (ano < 1900 || ano > 2100) return { estado: 'invalida' };
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return { estado: 'invalida' };
  }
  return { estado: 'ok', data };
}

export function fmtDataBR(data: Date | null | undefined): string {
  if (!data) return '';
  const d = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${data.getFullYear()}`;
}

export function mesmaData(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function mensagemDaLeitura(l: LeituraData): string | null {
  if (l.estado === 'incompleta') return MSG_DATA_INCOMPLETA;
  if (l.estado === 'invalida') return MSG_DATA_INVALIDA;
  return null;
}
