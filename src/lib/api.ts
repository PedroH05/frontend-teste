import { getSupabase } from './supabase';

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
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL ausente — preencher .env.local');
  }

  const {
    data: { session },
  } = await getSupabase().auth.getSession();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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
