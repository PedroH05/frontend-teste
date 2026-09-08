import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Só usado para autenticação (login, esqueci senha, sessão). Dado de negócio
// nunca passa por aqui — isso é o que a migração corrige (ver
// migration-plan/architecture/DECISIONS.md, ADR 0003: o browser não fala
// mais direto com o banco, só com a captacao-api).
//
// Lazy de propósito: o Next avalia módulos importados por Client Components
// mesmo durante a geração estática do build, e o SDK do Supabase lança erro
// na hora de criar o client se a URL estiver vazia. Sem env vars ainda
// (bloqueado por falta de acesso ao Supabase, ver DECISIONS.md), instanciar
// só na primeira chamada em runtime evita quebrar o build.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes — preencher .env.local',
      );
    }
    client = createClient(url, anonKey);
  }
  return client;
}
