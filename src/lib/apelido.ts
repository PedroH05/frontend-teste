import type { Cliente } from './types';

// Carteira mostra o apelido do cliente em vez do nome completo, pra ficar
// mais compacto — pedido 17/09/2026. O campo `cli` da captação/embarque é
// texto livre digitado por quem trabalha o processo (não é FK pra
// `clientes`), então às vezes vem com a razão social inteira (ex.:
// "HUESKER LTDA" em vez de "HUESKER"). Casamento em duas etapas:
//   1. Por CNPJ raiz — mais confiável, quando existe.
//   2. Por prefixo: algum apelido cadastrado é o começo do texto digitado
//      (cobre "HUESKER LTDA" → "HUESKER").
// Sem casamento nenhum, mostra o texto original — nunca esconde dado.
export function apelidoCliente(
  cliRaw: string | null | undefined,
  cnpj: string | null | undefined,
  clientes: Cliente[],
): string {
  const texto = (cliRaw ?? '').trim();
  const raiz = (cnpj ?? '').replace(/\D/g, '').slice(0, 8);
  if (raiz) {
    const porCnpj = clientes.find((c) => c.cnpjRaiz === raiz);
    if (porCnpj?.aliases[0]) return porCnpj.aliases[0];
  }
  const cliUpper = texto.toUpperCase();
  if (cliUpper) {
    for (const c of clientes) {
      for (const alias of c.aliases) {
        if (alias && cliUpper.startsWith(alias.toUpperCase())) return alias;
      }
    }
  }
  return texto;
}
