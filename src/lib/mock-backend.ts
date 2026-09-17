// "Backend" falso em memória pro modo demo — responde às mesmas rotas que
// apiFetch chamaria na captacao-api de verdade, sem rede nenhuma. Estado
// vive só na aba (reseta ao recarregar a página). Ver mock-mode.ts.
import type { Captacao, CaptacaoInput, Cliente, CockpitRow, ImportResult } from './types';
import { mockCarteira, mockCaptacoes, mockClientes } from './mock-data';
import { ApiError } from './api';

let carteira: CockpitRow[] = structuredClone(mockCarteira);
let captacoes: Captacao[] = structuredClone(mockCaptacoes);
let clientes: Cliente[] = structuredClone(mockClientes);
let nextCaptacaoId = 100;
let nextClienteId = 100;

function nowIso() {
  return new Date().toISOString();
}

// Backend real só grava 'EFETIVA' ou 'MANIFESTADA' — variantes DOCS/PARC
// são derivação de exibição (ver domain/cockpit.ts na captacao-api).
function stageFromInput(payload: CaptacaoInput): string {
  return payload.efetivada ? 'EFETIVA' : 'MANIFESTADA';
}

function buildCaptacao(id: number, payload: CaptacaoInput, base?: Captacao): Captacao {
  return {
    id,
    cli: payload.cli ?? base?.cli ?? null,
    referencia: payload.referencia ?? base?.referencia ?? null,
    eta: payload.eta ?? base?.eta ?? null,
    regime: payload.regime ?? base?.regime ?? null,
    bl: payload.bl ?? base?.bl ?? null,
    ce: payload.ce ?? base?.ce ?? null,
    container: payload.container ?? base?.container ?? null,
    quantidade: payload.quantidade ?? base?.quantidade ?? null,
    navio: payload.navio ?? base?.navio ?? null,
    despachante: payload.despachante ?? base?.despachante ?? null,
    terminalDescarga: payload.terminalDescarga ?? base?.terminalDescarga ?? null,
    terminalCaptado: payload.terminalCaptado ?? base?.terminalCaptado ?? null,
    observacao: payload.observacao ?? base?.observacao ?? null,
    cnpj: payload.cnpj ?? base?.cnpj ?? null,
    stage: stageFromInput(payload),
    docBl: payload.efetivada ? true : (payload.docBl ?? base?.docBl ?? false),
    docCe: payload.efetivada ? true : (payload.docCe ?? base?.docCe ?? false),
    docPl: payload.efetivada ? true : (payload.docPl ?? base?.docPl ?? false),
    docRecebidaEm: base?.docRecebidaEm ?? (payload.docBl || payload.docCe || payload.docPl ? nowIso().slice(0, 10) : null),
    prejuizoPublico: payload.prejuizoPublico ?? base?.prejuizoPublico ?? false,
    dateLabel: base?.dateLabel ?? null,
    createdAt: base?.createdAt ?? nowIso(),
  };
}

function syncCockpitRow(cap: Captacao) {
  const existing = carteira.find((r) => r.capId === cap.id);
  const row: CockpitRow = {
    cnpj: cap.cnpj ?? '',
    cli: cap.cli ?? '',
    ref: cap.referencia ?? cap.cli ?? '',
    eta: cap.eta ?? '',
    regime: cap.regime ?? '',
    ce: cap.ce ?? '',
    bl: cap.bl ?? '',
    navio: cap.navio ?? '',
    cont: cap.container ?? '',
    qtd: String(cap.quantidade ?? 1),
    desp: cap.despachante ?? '',
    atrac: cap.terminalDescarga ?? '',
    parc: cap.terminalCaptado ?? '',
    stage:
      cap.stage === 'EFETIVA'
        ? 'EFETIVA'
        : cap.docBl && cap.docCe && cap.docPl
          ? 'MANIFESTADA_DOCS'
          : 'MANIFESTADA_PARC',
    capId: cap.id,
    createdAt: cap.createdAt,
  };
  if (existing) {
    Object.assign(existing, row);
  } else {
    carteira = [row, ...carteira];
  }
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body || typeof init.body !== 'string') return {};
  try {
    return JSON.parse(init.body);
  } catch {
    return {};
  }
}

/** Roteador chamado por apiFetch quando o modo demo está ativo. */
export async function mockRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();

  if (path === '/carteira' && method === 'GET') {
    return { rows: carteira } as T;
  }

  if (path === '/clientes' && method === 'GET') {
    return [...clientes].sort((a, b) => a.name.localeCompare(b.name)) as T;
  }
  if (path === '/clientes' && method === 'POST') {
    const body = parseBody(init) as { name: string; cnpj?: string; aliases?: string[] };
    const cnpjRaiz = body.cnpj ? body.cnpj.replace(/\D/g, '').slice(0, 8) : null;
    if (cnpjRaiz && clientes.some((c) => c.cnpjRaiz === cnpjRaiz)) {
      throw new ApiError(409, 'Já existe cliente cadastrado com essa raiz de CNPJ.');
    }
    const cliente: Cliente = {
      id: nextClienteId++,
      name: body.name,
      cnpj: body.cnpj ?? null,
      cnpjRaiz,
      aliases: body.aliases ?? [],
      ativo: true,
    };
    clientes = [...clientes, cliente];
    return cliente as T;
  }
  const clienteIdMatch = /^\/clientes\/(\d+)$/.exec(path);
  if (clienteIdMatch && method === 'PATCH') {
    const id = Number(clienteIdMatch[1]);
    const base = clientes.find((c) => c.id === id);
    if (!base) throw new ApiError(404, 'Cliente não encontrado.');
    const body = parseBody(init) as { name?: string; cnpj?: string; aliases?: string[] };
    const cnpjRaiz = body.cnpj !== undefined ? body.cnpj.replace(/\D/g, '').slice(0, 8) || null : base.cnpjRaiz;
    if (body.cnpj !== undefined && cnpjRaiz && clientes.some((c) => c.id !== id && c.cnpjRaiz === cnpjRaiz)) {
      throw new ApiError(409, 'Já existe cliente cadastrado com essa raiz de CNPJ.');
    }
    const updated: Cliente = {
      ...base,
      name: body.name ?? base.name,
      cnpj: body.cnpj ?? base.cnpj,
      cnpjRaiz,
      aliases: body.aliases ?? base.aliases,
    };
    clientes = clientes.map((c) => (c.id === id ? updated : c));
    return updated as T;
  }
  if (clienteIdMatch && method === 'DELETE') {
    clientes = clientes.filter((c) => c.id !== Number(clienteIdMatch[1]));
    return {} as T;
  }

  if (path === '/captacoes' && method === 'GET') {
    return [...captacoes].sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1)) as T;
  }
  if (path === '/captacoes' && method === 'POST') {
    const body = parseBody(init) as CaptacaoInput;
    const cap = buildCaptacao(nextCaptacaoId++, body);
    captacoes = [cap, ...captacoes];
    syncCockpitRow(cap);
    return cap as T;
  }
  if (path === '/captacoes/captado' && method === 'POST') {
    const body = parseBody(init) as unknown as CaptacaoInput;
    const cap = buildCaptacao(nextCaptacaoId++, { ...body, efetivada: true });
    captacoes = [cap, ...captacoes];
    syncCockpitRow(cap);
    return cap as T;
  }
  const editMatch = /^\/captacoes\/(\d+)$/.exec(path);
  if (editMatch && method === 'PATCH') {
    const id = Number(editMatch[1]);
    const base = captacoes.find((c) => c.id === id);
    if (!base) throw new ApiError(404, 'Captação não encontrada.');
    const body = parseBody(init) as CaptacaoInput;
    const updated = buildCaptacao(id, body, base);
    captacoes = captacoes.map((c) => (c.id === id ? updated : c));
    syncCockpitRow(updated);
    return updated as T;
  }
  if (editMatch && method === 'DELETE') {
    const id = Number(editMatch[1]);
    captacoes = captacoes.filter((c) => c.id !== id);
    carteira = carteira.map((r) => (r.capId === id ? { ...r, capId: null, stage: 'NENHUM' } : r));
    return {} as T;
  }
  const efetivarMatch = /^\/captacoes\/(\d+)\/efetivar$/.exec(path);
  if (efetivarMatch && method === 'PATCH') {
    const id = Number(efetivarMatch[1]);
    const base = captacoes.find((c) => c.id === id);
    if (!base) throw new ApiError(404, 'Captação não encontrada.');
    const updated: Captacao = { ...base, stage: 'EFETIVA', docBl: true, docCe: true, docPl: true };
    captacoes = captacoes.map((c) => (c.id === id ? updated : c));
    syncCockpitRow(updated);
    return updated as T;
  }

  if (path === '/import/logcomex' && method === 'POST') {
    const result: ImportResult = { processados: 6, porCnpj: 4, provaveis: 2, ignorados: 1 };
    return result as T;
  }

  if (path === '/auth/me' && method === 'GET') {
    return { email: 'demo@valetrade.com.br' } as T;
  }

  throw new ApiError(404, `Rota de demo não implementada: ${method} ${path}`);
}
