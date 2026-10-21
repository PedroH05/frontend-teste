'use client';

import { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Filtro de/até do Histórico (pedido 13/10/2026) — troca o <input
// type="date"> de dia único por um popover com atalhos + dois meses,
// mesmo padrão de range-picker de apps de viagem. Puramente client-side:
// Histórico já lê tudo de GET /captacoes e filtra em memória, então não
// precisa de rota nova nem muda o schema.
export type Periodo = { inicio: Date | null; fim: Date | null };

// Extraída pra poder testar a matemática do intervalo sem precisar abrir o
// popover de verdade (Base UI trava em testes com jsdom — sem layout real,
// o clique no gatilho nunca resolve; mesmo problema de qualquer componente
// flutuante daqui, ver hover-card.tsx, que também não tem teste de abrir).
// Intervalo inclusivo dos dois lados, por dia (hora de `data` não importa).
export function estaNoPeriodo(data: Date, inicio: Date, fim: Date): boolean {
  const fimDoDia = new Date(fim);
  fimDoDia.setDate(fimDoDia.getDate() + 1);
  return data >= inicio && data < fimDoDia;
}

const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Nome do mês do cabeçalho do calendário — curto ("Outubro 2026", sem
// "de") e capitalizado só na primeira letra, nunca em cada palavra:
// `toLocaleDateString` dava "novembro de 2026" e o `capitalize` do
// Tailwind virava "De" maiúsculo, além de quebrar linha na coluna mais
// estreita do popover (pedido 13/10/2026, bug visto em print).
function nomeMes(d: Date): string {
  const mes = MESES[d.getMonth()];
  return `${mes[0].toUpperCase()}${mes.slice(1)} ${d.getFullYear()}`;
}

function meiaNoite(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function mesmoDia(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtCurto(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}

function fmtLongo(d: Date): string {
  return d.toLocaleDateString('pt-BR');
}

function primeiroDiaDoMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function diasDoMes(mes: Date): { data: Date; noMes: boolean }[] {
  const ano = mes.getFullYear();
  const m = mes.getMonth();
  const offset = new Date(ano, m, 1).getDay();
  const cursor = new Date(ano, m, 1 - offset);
  const dias: { data: Date; noMes: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    dias.push({ data: new Date(cursor), noMes: cursor.getMonth() === m });
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

type Preset = { nome: string; calc: (hoje: Date) => [Date, Date] };

const PRESETS: Preset[] = [
  { nome: 'Hoje', calc: (hoje) => [hoje, hoje] },
  {
    nome: 'Ontem',
    calc: (hoje) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() - 1);
      return [d, d];
    },
  },
  {
    nome: 'Últimos 7 dias',
    calc: (hoje) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() - 6);
      return [d, hoje];
    },
  },
  {
    nome: 'Últimos 30 dias',
    calc: (hoje) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() - 29);
      return [d, hoje];
    },
  },
  { nome: 'Este mês', calc: (hoje) => [primeiroDiaDoMes(hoje), hoje] },
  {
    nome: 'Mês passado',
    calc: (hoje) => {
      const mesAnterior = hoje.getMonth() - 1;
      const ano = mesAnterior < 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
      const mes = mesAnterior < 0 ? 11 : mesAnterior;
      return [new Date(ano, mes, 1), new Date(ano, mes + 1, 0)];
    },
  },
];

export function FiltroPeriodo({ value, onChange }: { value: Periodo; onChange: (v: Periodo) => void }) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Periodo>(value);
  const [mesBase, setMesBase] = useState(() => primeiroDiaDoMes(value.inicio ?? new Date()));
  const [presetAtivo, setPresetAtivo] = useState<string | null>(null);

  function alternar(abrir: boolean) {
    setAberto(abrir);
    if (abrir) {
      setRascunho(value);
      setPresetAtivo(null);
      setMesBase(primeiroDiaDoMes(value.inicio ?? new Date()));
    }
  }

  function clicarDia(d: Date) {
    setPresetAtivo(null);
    setRascunho((r) => {
      if (!r.inicio || (r.inicio && r.fim)) return { inicio: d, fim: null };
      if (d < r.inicio) return { inicio: d, fim: r.inicio };
      return { inicio: r.inicio, fim: d };
    });
  }

  function aplicarPreset(p: Preset) {
    const [inicio, fim] = p.calc(meiaNoite(new Date()));
    setRascunho({ inicio, fim });
    setPresetAtivo(p.nome);
    setMesBase(primeiroDiaDoMes(inicio));
  }

  function aplicar() {
    if (!rascunho.inicio || !rascunho.fim) return;
    onChange(rascunho);
    setAberto(false);
  }

  const temValor = !!(value.inicio && value.fim);
  const hoje = meiaNoite(new Date());

  return (
    <Popover open={aberto} onOpenChange={alternar}>
      <div
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium"
        style={{ borderColor: temValor ? 'var(--primary)' : 'var(--border)', color: temValor ? 'var(--primary)' : 'var(--foreground)' }}
      >
        <PopoverTrigger className="inline-flex items-center gap-1.5">
          <Calendar size={14} />
          {temValor
            ? mesmoDia(value.inicio, value.fim)
              ? fmtCurto(value.inicio!)
              : `${fmtCurto(value.inicio!)} – ${fmtCurto(value.fim!)}`
            : 'Período'}
        </PopoverTrigger>
        {temValor && (
          <button
            type="button"
            aria-label="Limpar período"
            onClick={() => onChange({ inicio: null, fim: null })}
            className="rounded-[5px] p-px"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      <PopoverContent
        align="start"
        className="w-[min(720px,calc(100vw-2.5rem))] rounded-[14px] p-0"
        style={{ background: 'var(--popover)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
      >
        <div className="flex flex-col sm:flex-row">
          <div
            className="flex gap-1 overflow-x-auto border-b p-2 sm:w-[156px] sm:flex-none sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0"
            style={{ borderColor: 'var(--border)' }}
          >
            {PRESETS.map((p) => (
              <button
                key={p.nome}
                type="button"
                onClick={() => aplicarPreset(p)}
                className="shrink-0 rounded-[8px] px-2.5 py-[9px] text-left text-[13px] font-medium whitespace-nowrap"
                style={
                  presetAtivo === p.nome
                    ? { background: 'var(--accent)', color: 'var(--primary)', fontWeight: 700 }
                    : { color: 'var(--foreground)' }
                }
              >
                {p.nome}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:p-4">
            {[mesBase, new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 1)].map((mes, i) => (
              <div key={i} className="min-w-0 flex-1">
                <div className="mb-2.5 flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="Mês anterior"
                    onClick={() => setMesBase((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[14px] leading-none"
                    style={{ background: 'var(--background)', color: 'var(--muted-foreground)', visibility: i === 0 ? 'visible' : 'hidden' }}
                  >
                    ‹
                  </button>
                  <strong className="text-[14.5px] font-bold whitespace-nowrap">{nomeMes(mes)}</strong>
                  <button
                    type="button"
                    aria-label="Próximo mês"
                    onClick={() => setMesBase((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[14px] leading-none"
                    style={{ background: 'var(--background)', color: 'var(--muted-foreground)', visibility: i === 1 ? 'visible' : 'hidden' }}
                  >
                    ›
                  </button>
                </div>
                <div className="mb-2 grid grid-cols-7 gap-1">
                  {DOW.map((d, idx) => (
                    <span
                      key={idx}
                      className="flex items-center justify-center text-[11.5px] font-bold tracking-[.03em] uppercase"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {d}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {diasDoMes(mes).map(({ data, noMes }, idx) => {
                    const inicioP = noMes && mesmoDia(data, rascunho.inicio);
                    const fimP = noMes && mesmoDia(data, rascunho.fim);
                    const ponta = inicioP || fimP;
                    const noIntervalo =
                      noMes && !!rascunho.inicio && !!rascunho.fim && data > rascunho.inicio && data < rascunho.fim;
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={!noMes}
                        onClick={() => clicarDia(data)}
                        className="relative flex aspect-square items-center justify-center rounded-[9px] text-[17px] leading-none"
                        style={{
                          color: !noMes ? 'var(--muted-foreground)' : ponta ? '#fff' : 'var(--foreground)',
                          opacity: !noMes ? 0.4 : 1,
                          background: ponta ? 'var(--primary)' : noIntervalo ? 'var(--accent)' : 'transparent',
                          fontWeight: ponta ? 700 : noIntervalo ? 600 : mesmoDia(data, hoje) ? 700 : 600,
                          fontVariantNumeric: 'tabular-nums',
                          cursor: noMes ? 'pointer' : 'default',
                        }}
                      >
                        {data.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5" style={{ borderColor: 'var(--border)' }}>
          <span className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            {rascunho.inicio && rascunho.fim ? (
              <>
                de <b style={{ color: 'var(--foreground)' }}>{fmtLongo(rascunho.inicio)}</b> até{' '}
                <b style={{ color: 'var(--foreground)' }}>{fmtLongo(rascunho.fim)}</b>
              </>
            ) : rascunho.inicio ? (
              <>
                de <b style={{ color: 'var(--foreground)' }}>{fmtLongo(rascunho.inicio)}</b> até — escolha a data final
              </>
            ) : (
              'Escolha a data de início'
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRascunho({ inicio: null, fim: null });
                setPresetAtivo(null);
              }}
              className="rounded-[9px] border px-3 py-[6px] text-[12px] font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={aplicar}
              disabled={!rascunho.inicio || !rascunho.fim}
              className="h-8 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/85 disabled:opacity-40"
            >
              Aplicar
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
