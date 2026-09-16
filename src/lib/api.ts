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
    if (res.status === 401) {
      // Sessão inválida/expirada no navegador (achado 16/09/2026: uma
      // funcionária ficou "logada" com um token que o backend não aceitava
      // mais e a tela só mostrava erro genérico — precisou alguém dizer pra
      // ela sair e entrar de novo). Toda rota exige token; um 401 só
      // acontece por sessão ruim, nunca por regra de negócio — então força
      // logout e manda pro login sozinho, sem depender de ninguém perceber.
      getSupabase()
        .auth.signOut()
        .finally(() => {
          // apiFetch não é componente/hook — não dá pra usar useRouter() aqui.
          // Recarga cheia é proposital: limpa qualquer estado do Next preso
          // com a sessão ruim, não só troca de rota.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          if (typeof window !== 'undefined') window.location.href = '/login';
        });
    }
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  // DELETE (e outras rotas sem corpo) vêm com Content-Length: 0 — chamar
  // res.json() nelas lança "Unexpected end of JSON input", o que sempre
  // caía no catch do chamador e nunca chegava a atualizar a tela (achado
  // testando exclusão com dado real: parecia bug de cache, era isso).
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
