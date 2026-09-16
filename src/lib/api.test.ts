import { describe, expect, it, vi, afterEach } from 'vitest';
import { apiFetch, ApiError } from './api';

vi.mock('./mock-mode', () => ({ isMockMode: () => false }));
const signOutMock = vi.fn().mockResolvedValue({ error: null });
vi.mock('./supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }),
      signOut: signOutMock,
    },
  }),
}));

describe('apiFetch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(res: Partial<Response> & { text: () => Promise<string> }) {
    global.fetch = vi.fn().mockResolvedValue(res as Response);
  }

  it('resposta com corpo vazio (DELETE) não lança e devolve undefined — bug real achado 16/09/2026', async () => {
    mockFetch({ ok: true, status: 200, text: () => Promise.resolve('') });
    await expect(apiFetch('/captacoes/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('resposta 204 sem corpo também não lança', async () => {
    mockFetch({ ok: true, status: 204, text: () => Promise.resolve('') });
    await expect(apiFetch('/captacoes/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('resposta com corpo JSON continua sendo parseada normalmente', async () => {
    mockFetch({ ok: true, status: 200, text: () => Promise.resolve('{"id":1,"cli":"TECNO"}') });
    await expect(apiFetch('/captacoes/1')).resolves.toEqual({ id: 1, cli: 'TECNO' });
  });

  it('erro (não ok) continua virando ApiError, não afetado pela mudança', async () => {
    mockFetch({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ message: 'Captação não encontrada' }),
      text: () => Promise.resolve(''),
    } as unknown as Partial<Response> & { text: () => Promise<string> });
    await expect(apiFetch('/captacoes/999')).rejects.toBeInstanceOf(ApiError);
  });

  describe('401 (sessão inválida/expirada)', () => {
    const originalLocation = window.location;

    afterEach(() => {
      Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
      signOutMock.mockClear();
    });

    it('desloga e manda pro /login sozinho — achado 16/09/2026, sessão travada exigia ajuda manual', async () => {
      // jsdom não deixa navegar de verdade; substitui location pra observar o redirect
      Object.defineProperty(window, 'location', { value: { href: '' }, writable: true, configurable: true });
      mockFetch({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Token inválido ou expirado' }),
        text: () => Promise.resolve(''),
      } as unknown as Partial<Response> & { text: () => Promise<string> });

      await expect(apiFetch('/captacoes')).rejects.toBeInstanceOf(ApiError);
      await vi.waitFor(() => expect(window.location.href).toBe('/login'));
      expect(signOutMock).toHaveBeenCalled();
    });

    it('erro 404/409 comum não desloga ninguém', async () => {
      mockFetch({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({ message: 'Duplicado' }),
        text: () => Promise.resolve(''),
      } as unknown as Partial<Response> & { text: () => Promise<string> });

      await expect(apiFetch('/clientes')).rejects.toBeInstanceOf(ApiError);
      expect(signOutMock).not.toHaveBeenCalled();
    });
  });
});
