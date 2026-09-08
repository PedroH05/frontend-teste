// Restaura a última aba visitada depois do login — mesmo comportamento do
// index.html original (lastView()/localStorage). Views persistentes: as que
// fazem sentido restaurar num F5 ("manual"/formulário não entra, igual lá).
export const NAV_VIEWS = ['carteira', 'clientes', 'dashboard', 'historico'] as const;
export type NavView = (typeof NAV_VIEWS)[number];

const KEY = 'lastView';

export function getLastView(): NavView {
  if (typeof window === 'undefined') return 'carteira';
  try {
    const v = window.localStorage.getItem(KEY);
    return (NAV_VIEWS as readonly string[]).includes(v ?? '') ? (v as NavView) : 'carteira';
  } catch {
    return 'carteira';
  }
}

export function setLastView(view: NavView) {
  try {
    window.localStorage.setItem(KEY, view);
  } catch {
    // localStorage indisponível (modo privado etc.) — não é crítico, ignora.
  }
}
