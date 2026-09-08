'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { getLastView } from '@/lib/last-view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';

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
    // Modo demo: não autentica, não toca o banco — só sinaliza pra Carteira
    // renderizar com dado fixo. Ver migration-plan/features/autenticacao.
    router.push('/carteira?demo=1');
  }

  if (recovery) return <NewPasswordForm />;

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold">Captação Valetrade</h1>
          <p className="text-sm text-muted-foreground">Entre para ver a carteira em tempo real</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <FieldContent>
              <Input
                id="email"
                type="email"
                autoComplete="username"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </FieldContent>
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 text-sm">
          <button type="button" onClick={handleForgot} className="text-muted-foreground underline">
            Esqueci minha senha
          </button>
          <button type="button" onClick={handleDemo} className="text-muted-foreground underline">
            Ver demonstração
          </button>
        </div>
      </div>
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
      <div className="flex min-h-svh items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm space-y-4 rounded-xl border bg-background p-8 text-center shadow-sm">
          <p className="text-sm">Senha atualizada! Já pode entrar com a nova senha.</p>
          <Button className="w-full" onClick={() => router.replace('/login')}>
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <h1 className="text-lg font-semibold">Defina uma nova senha</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            Salvar nova senha
          </Button>
        </form>
      </div>
    </div>
  );
}
