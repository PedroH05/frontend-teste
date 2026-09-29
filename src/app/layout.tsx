import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Trocado de Inter pra IBM Plex Sans (pedido 29/09/2026) — desenhada pra
// interface densa de dado/número, que é a maior parte do app. A variável
// dos dois se chamava "--font-geist-sans"/"-mono" desde o template inicial
// do Next.js mesmo já rodando Inter, não Geist — corrigido de vez aqui.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Captação Valetrade",
  description: "Cockpit de captação inteligente",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
