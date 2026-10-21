'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { getLastView } from '@/lib/last-view';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import { enableMockMode } from '@/lib/mock-mode';
import { applyTheme, getTheme } from '@/lib/theme';

// Comportamento portado de captacao-valetrade/public/index.html
// (doLoginUI, doForgot, onAuthStateChange). Ver
// migration-plan/features/autenticacao/CURRENT_BEHAVIOR.md.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Sessão já ativa (F5 na tela de login) → pula direto pra última aba.
  useEffect(() => {
    getSupabase().auth.getSession().then(({ data }) => {
      if (data.session) router.replace(`/${getLastView()}`);
    });
  }, [router]);

  // Reaplica o tema salvo — precisa disso aqui também, não só no AppShell,
  // pra F5 direto em /login (ex.: depois de logout) já vir no tema certo.
  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  // Link "esqueci minha senha" volta com esse evento — troca o prompt()
  // nativo do sistema antigo por um formulário de verdade.
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    const { data: sub } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      // Mensagem genérica — nunca o erro cru do Supabase, mesmo padrão do
      // sistema antigo.
      setError('E-mail ou senha inválidos.');
      return;
    }
    router.push(`/${getLastView()}`);
  }

  async function handleForgot() {
    setError('');
    setInfo('');
    if (!email) {
      setError('Digite seu e-mail no campo acima primeiro.');
      return;
    }
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setInfo('Enviamos um link de redefinição para o seu e-mail.');
  }

  function handleDemo() {
    // Modo demo: não autentica, não toca o banco — ativa a flag local que
    // faz apiFetch responder com dado fixo (ver lib/mock-mode.ts).
    enableMockMode();
    router.push('/carteira');
  }

  if (recovery) return <NewPasswordForm />;

  return (
    <LoginShell>
      <div className="space-y-1.5">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Entrar</h1>
        <p className="text-sm text-muted-foreground">Acesse a carteira de captação em tempo real.</p>
      </div>

      <form onSubmit={handleLogin} className="mt-7 space-y-4">
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <FieldContent>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              className="h-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FieldContent>
        </Field>
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <button
              type="button"
              onClick={handleForgot}
              className="text-xs font-medium text-primary hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>
          <FieldContent>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              className="h-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FieldContent>
        </Field>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        {info && <p className="text-sm font-medium text-success-text">{info}</p>}

        <Button type="submit" className="h-10 w-full" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" className="mt-4 h-10 w-full" onClick={handleDemo}>
        Ver demonstração
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">Dados fixos de exemplo, nada é gravado.</p>
    </LoginShell>
  );
}

// Moldura do login (redesign 21/10/2026): painel escuro da marca à
// esquerda (mesmo fundo do destaque do Dashboard) e formulário à direita.
// No celular só aparece o formulário, com a marca em cima.
function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="vt-dash-hero relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col">
        <div className="relative z-10 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem estática pequena, next/image não compensa aqui */}
          <img src="/valetrade-logo.png" alt="" className="size-10 object-contain" />
          <div>
            <b className="block text-[15px] font-bold tracking-wide">VALETRADE</b>
            <small className="block text-xs text-zinc-400">Captação Inteligente</small>
          </div>
        </div>
        <div className="relative z-10 mt-auto max-w-[440px]">
          <h2 className="text-[36px] leading-[1.1] font-semibold tracking-[-0.03em]">
            Cada contêiner no radar, do navio ao terminal.
          </h2>
          <ul className="mt-8 space-y-3 text-sm text-zinc-300">
            {[
              'Carteira com prazo e risco de cada processo',
              'Captação em etapas, com revisão antes de salvar',
              'Dashboard com o ritmo do mês',
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-white/10">
                  <Check className="size-3" aria-hidden="true" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem estática pequena, next/image não compensa aqui */}
            <img src="/valetrade-logo.png" alt="Valetrade" className="size-10 object-contain" />
            <div>
              <b className="block text-[15px] font-bold tracking-wide">VALETRADE</b>
              <small className="block text-xs text-muted-foreground">Captação Inteligente</small>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

function NewPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('A senha precisa ter no mínimo 6 caracteres.');
      return;
    }
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }


  if (done) {
    return (
      <LoginShell>
        <div className="space-y-5">
          <span className="flex size-11 items-center justify-center rounded-xl bg-success-soft text-success">
            <Check className="size-5" aria-hidden="true" />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Senha atualizada</h1>
            <p className="text-sm text-muted-foreground">Já pode entrar com a nova senha.</p>
          </div>
          <Button className="h-10 w-full" onClick={() => router.replace('/login')}>
            Ir para o login
          </Button>
        </div>
      </LoginShell>
    );
  }

  return (
    <LoginShell>
      <div className="space-y-1.5">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Defina uma nova senha</h1>
        <p className="text-sm text-muted-foreground">No mínimo 6 caracteres.</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <Field>
          <FieldLabel htmlFor="new-password">Nova senha</FieldLabel>
          <FieldContent>
            <Input
              id="new-password"
              type="password"
              minLength={6}
              className="h-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FieldContent>
        </Field>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-10 w-full">
          Salvar nova senha
        </Button>
      </form>
    </LoginShell>
  );
}
