'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, LogOut, Package, History as HistoryIcon, Search, Settings, StickyNote, User, Users } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { disableMockMode, isMockMode } from '@/lib/mock-mode';
import { apiFetch } from '@/lib/api';
import { banda } from '@/lib/risco';
import { applyTheme, getTheme } from '@/lib/theme';
import { applySkin, getSkin } from '@/lib/skin';
import { applySidebarRecolhida, getSidebarRecolhida } from '@/lib/sidebar';
import { applyStatusTexto, getStatusTexto } from '@/lib/status-texto';
import type { CockpitRow } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

// Sidebar/layout redesenhado (docs/valetrade-redesign/HANDOFF.md seção 2,
// 15/10/2026) com a Sidebar de verdade do shadcn, no lugar do .vt-side/
// .vt-nav/indicador deslizante escrito à mão. Precisa ser um Layout de
// verdade (src/app/(authed)/layout.tsx), não recriado por página — igual
// já valia antes.
//
// `recolhida` continua sendo a fonte da verdade (localStorage via
// lib/sidebar.ts, que também seta `data-sidebar` na raiz do documento —
// outras telas leem esse atributo por CSS, ex. colunas extras da
// Carteira/Histórico só aparecem recolhida). `SidebarProvider` é só
// controlado por cima dele (open = !recolhida), não ganhou uma segunda
// fonte de verdade.
//
// Botão "Buscar… Ctrl K": só visual por enquanto — o atalho de busca
// global é item da seção 6 do HANDOFF ("a confirmar com o time"), ainda
// não tem onClick nem listener de teclado.

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
  const [mock, setMock] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [criticos, setCriticos] = useState(0);
  const [recolhida, setRecolhida] = useState(false);

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
      <SidebarProvider open={!recolhida} onOpenChange={(open) => setRecolhida(!open)}>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2.5 px-1 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem estática pequena, next/image não compensa aqui */}
              <img src="/valetrade-logo.png" alt="Valetrade" className="h-8 w-8 shrink-0 object-contain" />
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <b className="block truncate text-[15px] font-bold tracking-wide text-sidebar-foreground">VALETRADE</b>
                <small className="block truncate text-[10.5px] text-sidebar-foreground/60">Captação Inteligente</small>
              </div>
              <SidebarTrigger
                aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
                className="shrink-0 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
              />
            </div>
            <button
              type="button"
              disabled
              title="Busca global — ainda não ligada (seção 6 do redesign)"
              className="flex h-10 items-center gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent px-3 text-sm text-sidebar-foreground/60 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              <Search className="size-4 shrink-0" />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Buscar…</span>
              <kbd className="rounded bg-sidebar-border px-1.5 py-0.5 font-mono text-[11px] text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                Ctrl K
              </kbd>
            </button>
          </SidebarHeader>
          <SidebarContent>
            {NAV_ITEMS.map((group) => (
              <SidebarGroup key={group.section}>
                <SidebarGroupLabel className="uppercase tracking-wider">{group.section}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const active = pathname?.startsWith(item.href) ?? false;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            render={<Link href={item.href} />}
                            isActive={active}
                            tooltip={item.label}
                            className="data-active:bg-primary data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground"
                          >
                            <item.icon />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                          {item.href === '/carteira' && criticos > 0 && (
                            <SidebarMenuBadge className="rounded-full bg-white/15 text-current">
                              {criticos}
                            </SidebarMenuBadge>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-2.5 border-t border-sidebar-border px-1 pt-3">
              <div className="relative shrink-0">
                <Avatar className="size-[34px]">
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground">
                    <User className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <span
                  title="Sessão ativa"
                  className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-sidebar bg-success"
                />
              </div>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <div className="truncate text-[12px] text-sidebar-foreground/60" title={userEmail}>
                  {userEmail || 'Sessão ativa'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair"
                aria-label="Sair"
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
              >
                <LogOut size={16} />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-w-0 overflow-y-auto bg-transparent">
          {mock && (
            <div
              className="sticky top-0 z-10 px-4 py-1.5 text-center text-[11px] font-bold tracking-wide text-white uppercase"
              style={{ background: 'var(--vt-c-jan)' }}
            >
              Modo demonstração — dados fixos, nada aqui é gravado de verdade
            </div>
          )}
          {children}
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
