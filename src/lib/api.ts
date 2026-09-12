import { getSupabase } from './supabase';
import { isMockMode } from './mock-mode';

// Cliente HTTP pra captacao-api. Toda chamada carrega o JWT da sessão atual
// do Supabase — é isso que substitui o acesso direto ao banco (ver
// migration-plan/comparison/API_COMPARISON.md).
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Modo demo: responde do "backend" falso em memória, sem rede nenhuma —
  // ver lib/mock-mode.ts e lib/mock-backend.ts.
  if (isMockMode()) {
    const { mockRequest } = await import('./mock-backend');
    return mockRequest<T>(path, init);
  }

  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL ausente — preencher .env.local');
  }

  const {
    data: { session },
  } = await getSupabase().auth.getSession();

  // Upload de arquivo (FormData) não pode ter Content-Type forçado — o
  // browser precisa gerar o boundary do multipart sozinho.
  const isFormData = init?.body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  return res.json() as Promise<T>;
}
