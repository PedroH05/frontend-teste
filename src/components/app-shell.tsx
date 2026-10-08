'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, LogOut, Package, History as HistoryIcon, PanelLeftClose, PanelLeftOpen, Settings, StickyNote, Users } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { disableMockMode, isMockMode } from '@/lib/mock-mode';
import { apiFetch } from '@/lib/api';
import { banda } from '@/lib/risco';
import { applyTheme, getTheme } from '@/lib/theme';
import { applySkin, getSkin } from '@/lib/skin';
import { applySidebarRecolhida, getSidebarRecolhida } from '@/lib/sidebar';
import { applyStatusTexto, getStatusTexto } from '@/lib/status-texto';
import type { CockpitRow } from '@/lib/types';

// Sidebar/layout portado de captacao-valetrade/public/index.html (.side,
// .brand, .nav, .side-foot, #navInd/moveNavInd()). Ver
// migration-plan/execution/PARITY_AUDIT_2026-09-09.md — item "navegação
// entre telas" e "logout" (antes ausentes na migração). Precisa ser um
// Layout de verdade (src/app/(authed)/layout.tsx), não recriado por
// página, senão o indicador não tem de onde deslizar.

const NAV_ITEMS = [
  { section: 'Operação', items: [{ href: '/carteira', label: 'Carteira', icon: Package }] },
  {
    section: 'Gestão',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/clientes', label: 'Clientes', icon: Users },
      { href: '/historico', label: 'Histórico', icon: HistoryIcon },
      { href: '/anotacoes', label: 'Anotações', icon: StickyNote },
    ],
  },
  { section: 'Sistema', items: [{ href: '/config', label: 'Config', icon: Settings }] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const navRefs = useRef(new Map<string, HTMLAnchorElement>());
  const indRef = useRef<HTMLDivElement>(null);
  const [mock, setMock] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [criticos, setCriticos] = useState(0);
  const [recolhida, setRecolhida] = useState(false);
  const asideRef = useRef<HTMLElement>(null);

  // Posiciona a faixa do item ativo no bloco de link atual. Chamada ao trocar
  // de página, ao recolher/expandir e no fim da animação de largura da sidebar
  // (senão a faixa fica fora do esquadro no meio do deslize).
  function posicionaIndicador() {
    const active = [...navRefs.current.entries()].find(([href]) => pathname?.startsWith(href));
    const ind = indRef.current;
    if (!active || !ind) {
      if (ind) ind.style.opacity = '0';
      return;
    }
    const el = active[1];
    ind.style.top = `${el.offsetTop}px`;
    ind.style.height = `${el.offsetHeight}px`;
    ind.style.opacity = '1';
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage (sistema externo), só existe no cliente
    setMock(isMockMode());
  }, [pathname]);

  useEffect(() => {
    // Sem botão de trocar na UI (tirado 02/10/2026) — só aplica o que já
    // estava salvo de antes, pra quem tinha escolhido escuro não voltar
    // pro claro sem querer.
    applyTheme(getTheme());
    applySkin(getSkin());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage (sistema externo), só existe no cliente
    setRecolhida(getSidebarRecolhida());
  }, []);

  useEffect(() => {
    applySidebarRecolhida(recolhida);
  }, [recolhida]);

  useEffect(() => {
    applyStatusTexto(getStatusTexto());
  }, []);

  useEffect(() => {
    // GET /auth/me existia desde o início mas nenhuma tela chamava — ver
    // PARITY_AUDIT_2026-09-09.md ("infraestrutura pronta, mas subutilizada").
    let active = true;
    apiFetch<{ email?: string }>('/auth/me')
      .then((data) => {
        if (active) setUserEmail(data.email ?? '');
      })
      .catch(() => {
        // sem sessão válida ainda / erro de rede — mantém o rodapé genérico
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // Badge da Carteira (#navBadge no original) — conta processos em band
    // "prej" (crítico). Busca própria, independente da página da Carteira,
    // porque o menu aparece em toda tela autenticada. Só na montagem do
    // AppShell (não a cada navegação) — refazer esse fetch/join a cada troca
    // de página deixava a navegação inteira mais lenta sem necessidade real
    // de tempo real no badge (ver conversa de 12/09/2026, "trava toda vez
    // que entro no Histórico").
    let active = true;
    apiFetch<{ rows: CockpitRow[] }>('/carteira')
      .then((data) => {
        if (active) setCriticos(data.rows.filter((r) => banda(r).k === 'prej').length);
      })
      .catch(() => {
        // sem dado ainda — badge some (ver render abaixo)
      });
    return () => {
      active = false;
    };
  }, []);

  // Move a "saliência" de vidro pro item ativo — mede a posição real do
  // link em vez de calcular por índice, igual moveNavInd() no original.
  useLayoutEffect(() => {
    posicionaIndicador();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- posicionaIndicador só lê pathname e refs; as dependências são as que disparam o reposicionamento
  }, [pathname, recolhida]);

  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    const aoTerminar = (e: TransitionEvent) => {
      if (e.propertyName === 'width') posicionaIndicador();
    };
    aside.addEventListener('transitionend', aoTerminar);
    return () => aside.removeEventListener('transitionend', aoTerminar);
  });

  async function handleLogout() {
    disableMockMode();
    try {
      await getSupabase().auth.signOut();
    } catch {
      // ignora — objetivo é sair da UI mesmo que a chamada falhe
    }
    router.push('/login');
  }

  return (
    <>
      <div className="vt-ambient-bg" />
      <div className="flex h-screen overflow-hidden">
        <aside ref={asideRef} className={`vt-side${recolhida ? ' vt-side-recolhida' : ''}`}>
          <div ref={indRef} className="vt-nav-ind" />
          <div className="vt-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem estática pequena, next/image não compensa aqui */}
            <img src="/valetrade-logo.png" alt="Valetrade" className="h-9 w-9 shrink-0 object-contain" />
            {!recolhida && (
              <div className="min-w-0 flex-1">
                <b className="vt-brand-shine block text-[15px] tracking-wide">VALETRADE</b>
                <small className="text-[10.5px]" style={{ color: 'var(--vt-muted)' }}>
                  Captação Inteligente
                </small>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setRecolhida((v) => !v)}
            className="vt-logout-btn self-end"
            title={recolhida ? 'Expandir menu' : 'Recolher menu'}
            aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
          >
            {recolhida ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          {NAV_ITEMS.map((group) => (
            <div key={group.section}>
              {!recolhida && <div className="vt-nav-sec">{group.section}</div>}
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  title={recolhida ? item.label : undefined}
                  ref={(el) => {
                    if (el) navRefs.current.set(item.href, el);
                    else navRefs.current.delete(item.href);
                  }}
                  className={`vt-nav${pathname?.startsWith(item.href) ? ' active' : ''}`}
                >
                  <item.icon className="ic" />
                  {!recolhida && <span>{item.label}</span>}
                  {item.href === '/carteira' && criticos > 0 && <span className="badge">{criticos}</span>}
                </Link>
              ))}
            </div>
          ))}
          <div className="vt-user-card">
            <div className="vt-avatar" title="Sessão ativa" />
            {!recolhida && (
              <div className="vt-user-meta">
                <div className="email" title={userEmail}>
                  {userEmail || 'Sessão ativa'}
                </div>
              </div>
            )}
            <button type="button" onClick={handleLogout} className="vt-logout-btn" title="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">
          {mock && (
            <div
              className="sticky top-0 z-10 px-4 py-1.5 text-center text-[11px] font-bold tracking-wide text-white uppercase"
              style={{ background: 'var(--vt-c-jan)' }}
            >
              Modo demonstração — dados fixos, nada aqui é gravado de verdade
            </div>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
