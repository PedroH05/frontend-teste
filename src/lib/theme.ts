// Modo escuro — flag persistida em localStorage, aplicada como
// data-theme="dark" na raiz do documento (ver globals.css, tokens --vt-*
// redefinidos sob [data-theme="dark"]). Ver conversa de 11/09/2026.
const KEY = 'vt-theme';

export type Theme = 'light' | 'dark';

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ignora — só é conveniência de UI
  }
}
