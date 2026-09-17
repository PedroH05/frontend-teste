'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, LogOut, Moon, Package, History as HistoryIcon, Sun, Users } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { disableMockMode, isMockMode } from '@/lib/mock-mode';
import { apiFetch } from '@/lib/api';
import { banda } from '@/lib/risco';
import { applyTheme, getTheme, type Theme } from '@/lib/theme';
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
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const navRefs = useRef(new Map<string, HTMLAnchorElement>());
  const indRef = useRef<HTMLDivElement>(null);
  const [mock, setMock] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [criticos, setCriticos] = useState(0);
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage (sistema externo), só existe no cliente
    setMock(isMockMode());
  }, [pathname]);

  useEffect(() => {
    const saved = getTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage (sistema externo), só existe no cliente
    setTheme(saved);
    applyTheme(saved);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }

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
  }, [pathname]);

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
        <aside className="vt-side">
          <div ref={indRef} className="vt-nav-ind" />
          <div className="vt-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem estática pequena, next/image não compensa aqui */}
            <img src="/valetrade-logo.png" alt="Valetrade" className="h-9 w-9 shrink-0 object-contain" />
            <div>
              <b className="vt-brand-shine block text-[15px] tracking-wide">VALETRADE</b>
              <small className="text-[10.5px]" style={{ color: 'var(--vt-muted)' }}>
                Captação Inteligente
              </small>
            </div>
          </div>
          {NAV_ITEMS.map((group) => (
            <div key={group.section}>
              <div className="vt-nav-sec">{group.section}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={(el) => {
                    if (el) navRefs.current.set(item.href, el);
                    else navRefs.current.delete(item.href);
                  }}
                  className={`vt-nav${pathname?.startsWith(item.href) ? ' active' : ''}`}
                >
                  <item.icon className="ic" />
                  <span>{item.label}</span>
                  {item.href === '/carteira' && criticos > 0 && <span className="badge">{criticos}</span>}
                </Link>
              ))}
            </div>
          ))}
          <div className="vt-user-card">
            <div className="vt-avatar" title="Sessão ativa" />
            <div className="vt-user-meta">
              <div className="email" title={userEmail}>
                {userEmail || 'Sessão ativa'}
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="vt-logout-btn"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
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
