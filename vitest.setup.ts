import '@testing-library/jest-dom/vitest';

// Padrão pra testes que exercitam lib/api.ts de verdade (não mockado) — o
// valor não importa, `fetch` é mockado em cada teste, só precisa existir
// pra `apiFetch` não recusar de cara (ver lib/api.ts).
process.env.NEXT_PUBLIC_API_URL ??= 'http://localhost:3000';
