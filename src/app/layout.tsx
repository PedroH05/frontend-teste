import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Manrope } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Geist/Geist Mono (redesign 13/10/2026, docs/valetrade-redesign/HANDOFF.md
// seção 1) — reverte a troca pra IBM Plex Sans de 29/09/2026 (que tinha
// motivo real: densidade de dado/número). Decisão explícita do redesign,
// não esquecimento.

// Manrope só no calendário do filtro de Período (pedido 24/11/2026), via
// `font-[family-name:var(--font-manrope)]` em components/filtro-periodo.tsx.
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "Captação Valetrade",
  description: "Cockpit de captação inteligente",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
