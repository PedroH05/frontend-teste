'use client';

import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { Captacao } from '@/lib/types';
import { splitBls } from '@/lib/bl-split';
import { shortTerm } from '@/lib/risco';
import { formatData, formatDataHora } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ship-scene';
import { RowActions } from '@/components/row-actions';
import { SegmentedControl } from '@/components/segmented-control';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

// Comportamento portado de captacao-valetrade/public/index.html
// (renderHistorico, setHistDia, setHistStatus). Ver
// migration-plan/features/historico/CURRENT_BEHAVIOR.md e
// migration-plan/prompts/05-historico.md. Sem rota de API própria — lê
// GET /captacoes (03-captacoes) e filtra no client, igual ao original.
type Dia = 'hoje' | 'ontem' | 'anteontem' | 'data' | 'tudo';
type StatusFiltro = 'todos' | 'conc' | 'efet' | 'and';

function inicioDoDia(offsetDias: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDias);
  return d;
}

function categoriaDe(stage: string | null): Exclude<StatusFiltro, 'todos'> {
  if (stage === 'SAIU_TERMINAL') return 'conc';
  if (stage === 'EFETIVA') return 'efet';
  return 'and';
}

const STAGE_LABEL: Record<string, string> = {
  SAIU_TERMINAL: 'Concluído',
  EFETIVA: 'Efetivado',
};

const PAGE_SIZE = 5;

type SortKey = 'registrado' | 'eta';

// Campo/Grupo do drawer de detalhe — mesmo padrão visual do RecapItem do
// formulário de captação (captacoes/page.tsx) e do drawer da Carteira
// (pedido 23/09/2026): rótulo pequeno em maiúsculo, "não informado" em
// itálico quando vazio, nunca esconde o campo.
function Campo({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold tracking-[.04em] uppercase" style={{ color: 'var(--vt-muted2)' }}>
        {label}
      </div>
      <div
        className="mt-0.5 text-[13px] font-semibold"
        style={value ? { color: 'var(--vt-ink)' } : { color: 'var(--vt-muted2)', fontStyle: 'italic', fontWeight: 500 }}
      >
        {value || 'não informado'}
      </div>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="mb-2 text-[11px] font-extrabold tracking-[.05em] uppercase" style={{ color: 'var(--vt-red)' }}>
        {titulo}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">{children}</div>
    </div>
  );
}

export default function HistoricoPage() {
  const router = useRouter();
  const [captacoes, setCaptacoes] = useState<Captacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dia, setDia] = useState<Dia>('tudo');
  // Dois critérios de ordenação: Registrado em (padrão) e ETA — pedido
  // 17/09/2026 (antes só dava pra ordenar por Registrado em, ETA não tinha
  // opção nenhuma). sortDir 1 = crescente (mais antigo/ETA mais distante
  // primeiro), -1 = decrescente (mais recente/ETA mais próxima primeiro) —
  // mesma convenção da Carteira. Troca de coluna sempre começa
  // decrescente, igual já era o padrão de "Registrado em".
  const [sortKey, setSortKey] = useState<SortKey>('registrado');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(-1);
    }
  }
  const [dataSel, setDataSel] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos');
  const [busca, setBusca] = useState('');
  // Detalhe em drawer (pedido 23/09/2026, mesmo padrão da Carteira) — clicar
  // na linha inteira abre um painel de baixo pra cima com todos os campos,
  // organizados nas mesmas seções do formulário de captação. Substitui o
  // antigo drawer só de BLs (a lista de BLs agora mora dentro deste).
  const [detalheRow, setDetalheRow] = useState<Captacao | null>(null);
  const [pagina, setPagina] = useState(1);

  function handleRowActivate(e: React.SyntheticEvent, c: Captacao) {
    if ((e.target as HTMLElement).closest('button')) return; // editar/excluir não abrem o drawer
    setDetalheRow(c);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Captacao[]>('/captacoes');
      setCaptacoes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Busca no mount — setState só depois do await dentro de load().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const alvo = useMemo((): Date | null => {
    if (dia === 'hoje') return inicioDoDia(0);
    if (dia === 'ontem') return inicioDoDia(1);
    if (dia === 'anteontem') return inicioDoDia(2);
    if (dia === 'data' && dataSel) return new Date(`${dataSel}T12:00:00`);
    return null;
  }, [dia, dataSel]);

  const linhas = useMemo(() => {
    let rows = [...captacoes];
    if (alvo) {
      rows = rows.filter((c) => {
        const d = c.createdAt ? new Date(c.createdAt) : null;
        return d && !Number.isNaN(d.getTime()) && d.toDateString() === alvo.toDateString();
      });
    }
    // Por padrão, data de registro mais recente primeiro — inclusive em
    // "Tudo". O original ordenava "Tudo" por ETA (index.html:1551), mas
    // pedido do Pedro em 16/09/2026: captação sem ETA (ou ETA distante)
    // ficava perdida no fim de uma lista paginada, difícil de achar logo
    // depois de criar. Mudança deliberada de comportamento, ver
    // docs/DECISIONS.md. Ordenar por ETA continua disponível clicando na
    // coluna (pedido 17/09/2026) — sem ETA conta como o valor mais antigo,
    // então continua indo pro fim independente da direção.
    const valorDeOrdenacao = (c: Captacao) => (sortKey === 'eta' ? (c.eta ?? '') : c.createdAt);
    rows.sort((a, b) => {
      const va = valorDeOrdenacao(a);
      const vb = valorDeOrdenacao(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
    });
    if (statusFiltro !== 'todos') {
      rows = rows.filter((c) => categoriaDe(c.stage) === statusFiltro);
    }
    if (busca) {
      const q = busca.trim().toLowerCase();
      rows = rows.filter((c) => JSON.stringify(c).toLowerCase().includes(q));
    }
    return rows;
  }, [captacoes, alvo, statusFiltro, busca, sortKey, sortDir]);

  // Volta pra página 1 sempre que o filtro muda o conjunto exibido — senão
  // dá pra ficar numa página que não existe mais (ex.: filtrou e sobrou só
  // 1 página, mas você tava na 4). Ajuste durante o render (não em efeito)
  // pra não gerar uma renderização em cascata — ver
  // https://react.dev/learn/you-might-not-need-an-effect.
  const [filtroAnterior, setFiltroAnterior] = useState({ alvo, statusFiltro, busca, sortKey, sortDir });
  if (
    filtroAnterior.alvo !== alvo ||
    filtroAnterior.statusFiltro !== statusFiltro ||
    filtroAnterior.busca !== busca ||
    filtroAnterior.sortKey !== sortKey ||
    filtroAnterior.sortDir !== sortDir
  ) {
    setFiltroAnterior({ alvo, statusFiltro, busca, sortKey, sortDir });
    setPagina(1);
  }

  const totalPaginas = Math.max(1, Math.ceil(linhas.length / PAGE_SIZE));
  const linhasPagina = useMemo(
    () => linhas.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
    [linhas, pagina],
  );

  async function handleDelete(id: number) {
    if (!confirm('Excluir este processo? Esta ação não pode ser desfeita.')) return;
    try {
      await apiFetch(`/captacoes/${id}`, { method: 'DELETE' });
      // Tira da tela na hora, sem esperar um novo GET — achado testando com
      // dado real: o `GET /captacoes` logo depois de um DELETE às vezes
      // ainda vinha com o item excluído (a Vercel injeta Cache-Control
      // público por padrão nas rotas da API; suspeita, não 100% confirmada).
      // Independente da causa, atualizar local garante a tela certa na hora.
      setCaptacoes((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  const glassInput = 'vt-glass-strong rounded-[11px] border-[var(--vt-line)] text-[13px]';
  const glassBtn =
    'vt-glass-strong rounded-[11px] border border-[var(--vt-line)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--vt-ink)] shadow-[var(--vt-sh)] transition hover:-translate-y-px';

  return (
    <div className="space-y-5 p-6 sm:p-8" style={{ color: 'var(--vt-ink)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[21px] font-bold tracking-tight">Histórico</h1>
            <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--vt-muted)' }}>
              Registro completo de tudo que já foi captado (todos os períodos)
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="vt-glass-strong rounded-[20px] px-3 py-1.5 text-[12px] font-semibold" style={{ color: 'var(--vt-muted)' }}>
              {linhas.length} captações
            </span>
            <Button
              variant="ghost"
              className="vt-btn-primary rounded-[11px] px-3.5 py-2 text-[12.5px] font-semibold transition hover:-translate-y-px"
              onClick={() => router.push('/captacoes')}
            >
              + Nova captação
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-[13px] font-semibold" style={{ color: 'var(--vt-c-prej)' }}>{error}</p>
        )}

        <div className="vt-glass overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-[14px_18px]" style={{ borderBottom: '1px solid var(--vt-line2)' }}>
            <h3 className="text-[14px] font-bold">Captações</h3>
            <SegmentedControl
              options={[
                { value: 'hoje', label: 'Hoje' },
                { value: 'tudo', label: 'Tudo' },
              ]}
              value={dia === 'data' ? 'tudo' : dia}
              onChange={(v: Dia) => setDia(v)}
            />
            <Input
              type="date"
              title="Escolher um dia"
              className={`w-auto ${glassInput}`}
              value={dataSel}
              onChange={(e) => {
                setDataSel(e.target.value);
                setDia(e.target.value ? 'data' : 'tudo');
              }}
            />
            <select
              className="vt-native-select"
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value as StatusFiltro)}
            >
              <option value="todos">Todos os status</option>
              <option value="efet">Efetivado</option>
              <option value="and">Em andamento</option>
              <option value="conc">Concluído</option>
            </select>
            <Input
              placeholder="buscar cliente, BL, navio…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className={`ml-auto w-[220px] ${glassInput}`}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: 'var(--vt-line)' }}>
                {['Status', 'Cliente / Referência'].map((h) => (
                  <TableHead key={h} className="text-[11px] font-semibold tracking-[.05em] uppercase" style={{ color: 'var(--vt-muted)' }}>
                    {h}
                  </TableHead>
                ))}
                {(
                  [
                    ['registrado', 'Registrado em'],
                    ['eta', 'ETA'],
                  ] as [SortKey, string][]
                ).map(([key, label]) => (
                  <TableHead
                    key={key}
                    className="cursor-pointer text-[11px] font-semibold tracking-[.05em] uppercase select-none"
                    style={{ color: sortKey === key ? 'var(--vt-red)' : 'var(--vt-muted)' }}
                    onClick={() => toggleSort(key)}
                  >
                    {label}{' '}
                    <span style={{ opacity: sortKey === key ? 1 : 0.35 }}>
                      {sortKey === key ? (sortDir === 1 ? '▲' : '▼') : '↕'}
                    </span>
                  </TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center" style={{ color: 'var(--vt-muted)' }}>
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : linhas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState title="Histórico vazio" subtitle="As captações aparecem aqui conforme forem feitas." />
                  </TableCell>
                </TableRow>
              ) : (
                linhasPagina.map((c) => (
                  <TableRow
                    key={c.id}
                    tabIndex={0}
                    aria-haspopup="dialog"
                    className="cursor-pointer"
                    style={{ borderColor: 'var(--vt-line)' }}
                    onClick={(e) => handleRowActivate(e, c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowActivate(e, c);
                      }
                    }}
                  >
                    <TableCell>
                      <span className={`vt-band ${c.stage === 'SAIU_TERMINAL' ? 'b-conc' : c.stage === 'EFETIVA' ? 'b-efet' : 'b-and'}`}>
                        {STAGE_LABEL[c.stage ?? ''] ?? 'Em andamento'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[170px]">
                      <div className="flex flex-col gap-px">
                        <span
                          title={c.cli ?? undefined}
                          className="truncate text-[13.5px] font-bold"
                          style={{ color: 'var(--vt-red)' }}
                        >
                          {c.cli}
                        </span>
                        <span
                          title={c.referencia ?? undefined}
                          className="truncate text-[11px]"
                          style={{ color: 'var(--vt-muted)' }}
                        >
                          {c.referencia}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {formatDataHora(c.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatData(c.eta)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <RowActions
                        onEdit={() => router.push(`/captacoes?edit=${c.id}`)}
                        onDelete={() => handleDelete(c.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!loading && linhas.length > 0 && (
            <div
              className="flex items-center justify-between px-[18px] py-3 text-[12px]"
              style={{ borderTop: '1px solid var(--vt-line2)', color: 'var(--vt-muted)' }}
            >
              <span>
                Página {pagina} de {totalPaginas} · {linhas.length} processos
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  className="vt-glass-strong rounded-[9px] border border-[var(--vt-line)] px-2.5 py-1 text-[12px] font-semibold text-[var(--vt-ink)] shadow-[var(--vt-sh)] transition hover:-translate-y-px disabled:opacity-40"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  ‹ Anterior
                </Button>
                <Button
                  variant="ghost"
                  className="vt-glass-strong rounded-[9px] border border-[var(--vt-line)] px-2.5 py-1 text-[12px] font-semibold text-[var(--vt-ink)] shadow-[var(--vt-sh)] transition hover:-translate-y-px disabled:opacity-40"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                >
                  Próxima ›
                </Button>
              </div>
            </div>
          )}
        </div>

        <Drawer
          open={!!detalheRow}
          onOpenChange={(open) => {
            if (!open) setDetalheRow(null);
          }}
          showSwipeHandle
        >
          <DrawerContent>
            {detalheRow && (
              <>
                <DrawerHeader>
                  <DrawerTitle>{detalheRow.cli}</DrawerTitle>
                  <DrawerDescription>{detalheRow.referencia}</DrawerDescription>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-2">
                  <Grupo titulo="Identificação">
                    <Campo label="CNPJ" value={detalheRow.cnpj} />
                    <Campo label="Cliente" value={detalheRow.cli} />
                    <Campo label="Referência" value={detalheRow.referencia} />
                  </Grupo>
                  <Grupo titulo="Carga">
                    <Campo label="ETA" value={detalheRow.eta ? formatData(detalheRow.eta) : undefined} />
                    <Campo label="Navio" value={detalheRow.navio} />
                    <Campo label="Qtde de contêineres" value={detalheRow.quantidade ?? undefined} />
                    <Campo label="Container(s)" value={detalheRow.container} />
                  </Grupo>
                  <Grupo titulo="Aduana">
                    <Campo label="CE Mercante" value={detalheRow.ce} />
                    <Campo label="Regime" value={detalheRow.regime} />
                    <Campo label="HBL" value={splitBls(detalheRow.bl).join(', ') || undefined} />
                    <Campo label="Despachante" value={detalheRow.despachante} />
                  </Grupo>
                  <Grupo titulo="Terminal">
                    <Campo label="Atracação" value={shortTerm(detalheRow.terminalDescarga)} />
                    <Campo label="Parceiro" value={shortTerm(detalheRow.terminalCaptado)} />
                  </Grupo>
                  <Grupo titulo="Situação">
                    <Campo label="Status" value={STAGE_LABEL[detalheRow.stage ?? ''] ?? 'Em andamento'} />
                    <Campo label="Registrado em" value={formatDataHora(detalheRow.createdAt)} />
                    <Campo
                      label="Docs recebidos"
                      value={
                        [detalheRow.docBl && 'BL', detalheRow.docCe && 'CE', detalheRow.docPl && 'PL']
                          .filter(Boolean)
                          .join(', ') || undefined
                      }
                    />
                    <Campo label="Tabela pública" value={detalheRow.prejuizoPublico ? 'Sim' : 'Não'} />
                    <Campo label="Observação" value={detalheRow.observacao} />
                  </Grupo>
                </div>
                <DrawerFooter>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      className="vt-btn-primary rounded-[11px] px-3.5 py-2 text-[12.5px] font-semibold transition hover:-translate-y-px"
                      onClick={() => router.push(`/captacoes?edit=${detalheRow.id}`)}
                    >
                      Editar
                    </Button>
                    <Button variant="ghost" className={glassBtn} onClick={() => setDetalheRow(null)}>
                      Fechar
                    </Button>
                  </div>
                </DrawerFooter>
              </>
            )}
          </DrawerContent>
        </Drawer>
      </div>
  );
}
