// Tema visual (não confundir com claro/escuro, ver theme.ts) — escolha
// entre o visual "Clássico" (vidro/creme, o app desde a migração) e "Novo"
// (sidebar preta sólida, fundo pérola; pedido 01/10/2026, referência
// cotacoes-valetrade-code). Persistido em localStorage, aplicado como
// data-skin na raiz (ver globals.css, regras sob
// `:root:not([data-skin='classic'])`). "new" é o padrão — quem nunca abriu
// /config continua vendo o visual já publicado, sem mudança de comportamento.
const KEY = 'vt-skin';

export type Skin = 'classic' | 'new';

export function getSkin(): Skin {
  if (typeof window === 'undefined') return 'new';
  try {
    return localStorage.getItem(KEY) === 'classic' ? 'classic' : 'new';
  } catch {
    return 'new';
  }
}

export function applySkin(skin: Skin) {
  document.documentElement.dataset.skin = skin;
  try {
    localStorage.setItem(KEY, skin);
  } catch {
    // ignora — só é conveniência de UI
  }
}
