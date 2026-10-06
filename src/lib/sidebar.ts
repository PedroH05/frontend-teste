// Sidebar recolhida (só ícones) — escolha persistida em localStorage e
// refletida como data-sidebar na raiz, pra qualquer tela reagir por CSS
// (ex.: colunas extras da Carteira só aparecem recolhida). Padrão: aberta.
const KEY = 'vt-sidebar';

export function getSidebarRecolhida(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(KEY) === 'recolhida';
  } catch {
    return false;
  }
}

export function applySidebarRecolhida(recolhida: boolean) {
  document.documentElement.dataset.sidebar = recolhida ? 'recolhida' : 'aberta';
  try {
    localStorage.setItem(KEY, recolhida ? 'recolhida' : 'aberta');
  } catch {
    // ignora — só é conveniência de UI
  }
}
