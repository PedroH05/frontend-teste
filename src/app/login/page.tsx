'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { getLastView } from '@/lib/last-view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import { ShipScene } from '@/components/ship-scene';
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

  const glassInput = 'vt-glass-strong rounded-[10px] border-[var(--vt-line)] text-[13px]';

  return (
    <>
      <div className="vt-ambient-bg" />
      <div className="vt-login-overlay flex min-h-svh items-center justify-center px-4">
      <div className="vt-glass-strong relative w-full max-w-[360px] overflow-hidden rounded-[18px] p-[30px_28px] text-center shadow-[var(--vt-sh-lg)]">
        <div className="relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem estática pequena, next/image não compensa aqui */}
          <img src="/valetrade-logo.png" alt="Valetrade" className="mx-auto mb-3.5 block h-14 w-14 object-contain" />
          <h1 className="mb-1 text-[18px] font-bold" style={{ color: 'var(--vt-ink)' }}>Captação Valetrade</h1>
          <p className="mb-[18px] text-[12.5px]" style={{ color: 'var(--vt-muted)' }}>Entre para ver a carteira em tempo real</p>

          <form onSubmit={handleLogin} className="space-y-2.5 text-left">
            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <FieldContent>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  className={glassInput}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <FieldContent>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className={glassInput}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </FieldContent>
            </Field>

            {error && <p className="text-[12px]" style={{ color: 'var(--vt-c-prej)' }}>{error}</p>}
            {info && <p className="text-[12px] text-emerald-600">{info}</p>}

            <Button
              type="submit"
              className="mt-1 w-full rounded-[10px] py-3 font-bold"
              style={{ background: 'linear-gradient(150deg, #CC0000, #A50016)' }}
              disabled={loading}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          <div className="flex flex-col items-center gap-2 text-[12px]" style={{ color: 'var(--vt-muted)' }}>
            <button type="button" onClick={handleForgot} className="mt-3 underline">
              Esqueci minha senha
            </button>
            <button type="button" onClick={handleDemo} className="underline">
              Ver demonstração
            </button>
          </div>
        </div>

        <div className="vt-login-sail">
          <ShipScene waves={false} />
        </div>
      </div>
      </div>
    </>
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

  const shell = (children: React.ReactNode) => (
    <>
      <div className="vt-ambient-bg" />
      <div className="vt-login-overlay flex min-h-svh items-center justify-center px-4">
        <div className="vt-glass-strong w-full max-w-[360px] rounded-[18px] p-[30px_28px] text-center shadow-[var(--vt-sh-lg)]" style={{ color: 'var(--vt-ink)' }}>
          {children}
        </div>
      </div>
    </>
  );

  if (done) {
    return shell(
      <div className="space-y-4">
        <p className="text-[13px]">Senha atualizada! Já pode entrar com a nova senha.</p>
        <Button
          className="w-full rounded-[10px] py-3 font-bold"
          style={{ background: 'linear-gradient(150deg, #CC0000, #A50016)' }}
          onClick={() => router.replace('/login')}
        >
          Ir para o login
        </Button>
      </div>,
    );
  }

  return shell(
    <>
      <h1 className="mb-4 text-[18px] font-bold">Defina uma nova senha</h1>
      <form onSubmit={handleSubmit} className="space-y-2.5 text-left">
        <Field>
          <FieldLabel htmlFor="new-password">Nova senha</FieldLabel>
          <FieldContent>
            <Input
              id="new-password"
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FieldContent>
        </Field>
        {error && <p className="text-[12px]" style={{ color: 'var(--vt-c-prej)' }}>{error}</p>}
        <Button
          type="submit"
          className="w-full rounded-[10px] py-3 font-bold"
          style={{ background: 'linear-gradient(150deg, #CC0000, #A50016)' }}
        >
          Salvar nova senha
        </Button>
      </form>
    </>,
  );
}
