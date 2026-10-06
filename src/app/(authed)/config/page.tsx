'use client';

import { useEffect, useState } from 'react';
import { applySkin, getSkin, type Skin } from '@/lib/skin';
import { applyStatusTexto, getStatusTexto } from '@/lib/status-texto';

// Única configuração por enquanto: tema visual (pedido 02/10/2026) — não é
// o mesmo toggle de claro/escuro (lib/theme.ts, botão no AppShell), é a
// escolha entre o visual "Clássico" (vidro/creme, como o app era até
// 01/10/2026) e "Novo" (sidebar preta sólida, fundo pérola; referência
// cotacoes-valetrade-code). Ver globals.css, regras sob
// `:root:not([data-skin='classic'])`.
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
  const sidebarBg = v === 'new' ? '#11141A' : 'var(--vt-glass)';
  const pageBg = v === 'new' ? '#F3F4F6' : '#f3efe8';
  const activeBg = v === 'new' ? 'var(--vt-red)' : 'transparent';
  return (
    <div
      className="flex h-[74px] overflow-hidden rounded-[10px]"
      style={{ border: '1px solid var(--vt-line)' }}
      aria-hidden="true"
    >
      <div className="flex w-[34px] flex-col gap-1.5 p-1.5" style={{ background: sidebarBg }}>
        <div
          className="h-[9px] rounded-[3px]"
          style={{ background: activeBg, border: v === 'classic' ? '1px solid var(--vt-red)' : 'none' }}
        />
        <div className="h-[6px] w-[70%] rounded-[2px]" style={{ background: v === 'new' ? 'rgba(255,255,255,.25)' : 'var(--vt-line)' }} />
        <div className="h-[6px] w-[55%] rounded-[2px]" style={{ background: v === 'new' ? 'rgba(255,255,255,.25)' : 'var(--vt-line)' }} />
      </div>
      <div className="flex-1 p-2" style={{ background: pageBg }}>
        <div className="h-[8px] w-[60%] rounded-[2px]" style={{ background: 'var(--vt-line)' }} />
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
  }, []);

  function alternarStatusTexto() {
    const proximo = !statusTexto;
    setStatusTexto(proximo);
    applyStatusTexto(proximo);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage (sistema externo), só existe no cliente
    setSkin(getSkin());
  }, []);

  function escolher(v: Skin) {
    setSkin(v);
    applySkin(v);
  }

  return (
    <div className="space-y-5 p-6 sm:p-8" style={{ color: 'var(--vt-ink)' }}>
      <div>
        <h1 className="text-[21px] font-bold tracking-tight">Config</h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--vt-muted)' }}>
          Preferências da sua sessão neste navegador.
        </p>
      </div>

      <div className="vt-glass max-w-[640px] p-[18px_20px] flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[14px] font-bold">Mostrar o nome do status</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--vt-muted)' }}>
            Desligado: só o ícone colorido nas tabelas (o nome aparece ao passar o mouse).
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={statusTexto}
          onClick={alternarStatusTexto}
          className="relative h-[22px] w-[40px] shrink-0 rounded-full transition"
          style={{ background: statusTexto ? 'var(--vt-red)' : 'var(--vt-line)' }}
        >
          <span
            className="absolute top-[3px] left-[3px] size-4 rounded-full bg-white transition-transform"
            style={{ transform: statusTexto ? 'translateX(18px)' : 'translateX(0)' }}
          />
        </button>
      </div>

      <div className="vt-glass max-w-[640px] p-[18px_20px]">
        <h2 className="text-[14px] font-bold">Tema visual</h2>
        <p className="mt-1 text-[12.5px]" style={{ color: 'var(--vt-muted)' }}>
          Independente do modo claro/escuro — só a &quot;pele&quot; do app.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {OPCOES.map((o) => {
            const ativo = skin === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => escolher(o.v)}
                className="rounded-[12px] p-3 text-left transition"
                style={{
                  background: ativo ? 'var(--vt-glass-strong)' : 'transparent',
                  border: `1.5px solid ${ativo ? 'var(--vt-red)' : 'var(--vt-line)'}`,
                }}
              >
                <Amostra v={o.v} />
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-[13px] font-bold">{o.titulo}</span>
                  {ativo && (
                    <span
                      className="rounded-[20px] px-2 py-[1px] text-[10px] font-bold"
                      style={{ background: 'var(--vt-bg-prej)', color: 'var(--vt-red)' }}
                    >
                      atual
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11.5px] leading-snug" style={{ color: 'var(--vt-muted)' }}>
                  {o.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
