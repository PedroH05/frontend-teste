import { redirect } from 'next/navigation';

// A raiz não tem tela própria — sempre cai no login. A checagem de sessão
// (pular direto pra última aba se já estiver logado) é feita dentro de
// /login, não aqui.
export default function Home() {
  redirect('/login');
}
