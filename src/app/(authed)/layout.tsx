import { AppShell } from '@/components/app-shell';

// Layout compartilhado das 5 telas autenticadas — precisa ser um layout de
// verdade (não um componente re-renderizado por página) pra sidebar
// persistir entre navegações e o indicador deslizante (.nav-ind do
// index.html original) poder animar de um item pro outro em vez de só
// aparecer/desaparecer a cada troca de rota.
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
