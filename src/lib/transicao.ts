// Direção do deslize entre telas (pedido 24/11/2026, opção C do artefato
// "Transições entre telas"): descer no menu entra pela direita
// (`nav-forward`), subir entra pela esquerda (`nav-back`). A ordem é a da
// barra lateral; "Nova captação" fica logo depois da Carteira, de onde
// costuma ser aberta. Os tipos viram `transitionTypes` no <Link>/router e
// são lidos pelo <ViewTransition> de `components/transicao-tela.tsx`.
export const ORDEM_TELAS = [
  '/carteira',
  '/captacoes',
  '/dashboard',
  '/clientes',
  '/historico',
  '/anotacoes',
  '/config',
] as const;

export type TipoTransicao = 'nav-forward' | 'nav-back';

function posicao(caminho: string | null | undefined): number {
  if (!caminho) return -1;
  return ORDEM_TELAS.findIndex((t) => caminho === t || caminho.startsWith(`${t}/`) || caminho.startsWith(`${t}?`));
}

// Tela desconhecida (login, rota nova fora da lista) desliza pra frente.
export function tipoTransicao(de: string | null | undefined, para: string): TipoTransicao {
  const a = posicao(de);
  const b = posicao(para);
  if (a < 0 || b < 0) return 'nav-forward';
  return b < a ? 'nav-back' : 'nav-forward';
}
