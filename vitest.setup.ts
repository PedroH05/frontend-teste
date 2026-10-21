import '@testing-library/jest-dom/vitest';

// Padrão pra testes que exercitam lib/api.ts de verdade (não mockado) — o
// valor não importa, `fetch` é mockado em cada teste, só precisa existir
// pra `apiFetch` não recusar de cara (ver lib/api.ts).
process.env.NEXT_PUBLIC_API_URL ??= 'http://localhost:3000';

// jsdom não tem PointerEvent — o Switch do @base-ui/react cria um ao
// clicar e quebra sem ele. Polyfill mínimo em cima de MouseEvent.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}
