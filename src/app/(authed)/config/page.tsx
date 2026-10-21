'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { applySkin, getSkin, type Skin } from '@/lib/skin';
import { applyStatusTexto, getStatusTexto } from '@/lib/status-texto';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/status-badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Tema visual (pedido 02/10/2026) — não é o mesmo toggle de claro/escuro
// (lib/theme.ts), é a escolha entre o visual "Clássico" (vidro/creme, como
// o app era até 01/10/2026) e "Novo" (sidebar preta sólida, fundo pérola).
// Ver globals.css, regras sob `:root:not([data-skin='classic'])`.
const OPCOES: { v: Skin; titulo: string; desc: string }[] = [
  {
    v: 'new',
    titulo: 'Novo',
    desc: 'Sidebar preta sólida, item ativo vermelho, fundo pérola chapado.',
  },
  {
    v: 'classic',
    titulo: 'Clássico',
    desc: 'Sidebar em vidro translúcido seguindo o tema claro/escuro, fundo creme com gradiente suave.',
  },
];

function Amostra({ v }: { v: Skin }) {
  const novo = v === 'new';
  return (
    <div className="flex h-[84px] overflow-hidden rounded-lg border" aria-hidden="true">
      <div className={cn('flex w-[38px] flex-col gap-1.5 p-1.5', novo ? 'bg-sidebar' : 'bg-white/60 backdrop-blur')}>
        <span className={cn('h-[9px] rounded-[3px]', novo ? 'bg-primary' : 'border border-primary')} />
        <span className={cn('h-[6px] w-[70%] rounded-[2px]', novo ? 'bg-white/25' : 'bg-border')} />
        <span className={cn('h-[6px] w-[55%] rounded-[2px]', novo ? 'bg-white/25' : 'bg-border')} />
      </div>
      <div className={cn('flex-1 space-y-1.5 p-2', novo ? 'bg-[#F4F4F5]' : 'bg-gradient-to-br from-[#f6f1e9] to-[#ece4d6]')}>
        <span className="block h-[8px] w-[60%] rounded-[2px] bg-border" />
        <span className="block h-[22px] rounded-[4px] border bg-white" />
      </div>
    </div>
  );
}

export default function ConfigPage() {
  const [skin, setSkin] = useState<Skin>('new');
  const [statusTexto, setStatusTexto] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage (sistema externo), só existe no cliente
    setStatusTexto(getStatusTexto());
    setSkin(getSkin());
  }, []);

  function mudarStatusTexto(mostrar: boolean) {
    setStatusTexto(mostrar);
    applyStatusTexto(mostrar);
  }

  function escolher(v: Skin) {
    setSkin(v);
    applySkin(v);
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 p-6 sm:p-8 lg:px-10">
      <header className="space-y-1.5">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>Sistema</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Config</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Config</h1>
        <p className="text-sm text-muted-foreground">Preferências da sua sessão neste navegador.</p>
      </header>

      <section aria-labelledby="cfg-exibicao" className="max-w-[720px] rounded-xl border bg-card shadow-sm">
        <h2 id="cfg-exibicao" className="border-b px-5 py-4 text-[15px] font-semibold">
          Exibição
        </h2>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <span id="cfg-status-label" className="block text-sm font-medium">
              Mostrar o nome do status
            </span>
            <span className="mt-0.5 block text-[13px] text-muted-foreground">
              {statusTexto
                ? 'Ligado: o nome aparece escrito no badge.'
                : 'Desligado: só o ícone colorido nas tabelas (o nome aparece ao passar o mouse).'}
            </span>
          </div>
          <Switch
            aria-labelledby="cfg-status-label"
            checked={statusTexto}
            onCheckedChange={(v) => mudarStatusTexto(v === true)}
          />
        </div>
        <div className="flex items-center gap-3 border-t bg-muted/40 px-5 py-3.5 text-[13px] text-muted-foreground">
          Prévia:
          <StatusBadge k="efet" label="Efetivado" />
          <StatusBadge k="and" label="Em andamento" />
          <StatusBadge k="prej" label="Crítico" />
        </div>
      </section>

      <section aria-labelledby="cfg-tema" className="max-w-[720px] rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 id="cfg-tema" className="text-[15px] font-semibold">
            Tema visual
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Independente do modo claro/escuro — só a &quot;pele&quot; do app.
          </p>
        </div>
        <div role="radiogroup" aria-labelledby="cfg-tema" className="grid gap-3 p-5 sm:grid-cols-2">
          {OPCOES.map((o) => {
            const ativo = skin === o.v;
            return (
              <label
                key={o.v}
                className={cn(
                  'cursor-pointer rounded-xl border p-3 transition hover:bg-muted/40',
                  ativo && 'border-primary ring-2 ring-primary/15 hover:bg-transparent',
                )}
              >
                <Amostra v={o.v} />
                <span className="mt-3 flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="tema"
                    value={o.v}
                    checked={ativo}
                    onChange={() => escolher(o.v)}
                    className="mt-0.5 size-4 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {o.titulo}
                      {ativo && (
                        <span className="rounded-full bg-accent px-2 py-px text-[11px] font-semibold text-primary">
                          Atual
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-muted-foreground">{o.desc}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
