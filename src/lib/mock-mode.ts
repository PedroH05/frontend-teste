// Modo demo — ver mock-data.ts. Flag persistida em localStorage (não em
// query string) pra sobreviver à navegação entre telas pela sidebar.
const KEY = 'vt-mock-mode';

export function isMockMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function enableMockMode() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // ignora — só é conveniência de UI
  }
}

export function disableMockMode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}
