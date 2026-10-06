// Status das tabelas: só ícone e cor (padrão) ou com o nome escrito.
// Persistido em localStorage e refletido em data-status-texto na raiz.
const KEY = 'vt-status-texto';

export function getStatusTexto(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(KEY) === 'mostrar';
  } catch {
    return false;
  }
}

export function applyStatusTexto(mostrar: boolean) {
  document.documentElement.dataset.statusTexto = mostrar ? 'mostrar' : 'ocultar';
  try {
    localStorage.setItem(KEY, mostrar ? 'mostrar' : 'ocultar');
  } catch {
    // ignora — só é conveniência de UI
  }
}
