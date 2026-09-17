// Modo demo — dado fixo local, não toca o Supabase nem a captacao-api.
// Portado do array `DEMO`/modo demo do captacao-valetrade/public/index.html
// (era código morto lá, nunca exposto na UI antiga — ver
// PARITY_AUDIT_2026-09-09.md). Aqui vira uma feature de verdade: só serve
// pra visualizar a interface populada sem precisar de acesso ao banco real.
// Ativado pelo botão "Ver demonstração" do login (ver mock-mode.ts).
import type { Captacao, Cliente, CockpitRow } from './types';

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const mockClientes: Cliente[] = [
  { id: 1, name: 'ALUZEN COMPONENTES AUTOMOTIVOS LTDA', cnpj: '12.345.678/0001-90', cnpjRaiz: '12345678', aliases: ['ALUZEN'], ativo: true },
  { id: 2, name: 'TECNO AMERICA IMPORTACAO LTDA', cnpj: '23.456.789/0001-01', cnpjRaiz: '23456789', aliases: ['TECNO', 'TECNOAMERICA'], ativo: true },
  { id: 3, name: 'HB TINTAS E VERNIZES LTDA', cnpj: '34.567.890/0001-12', cnpjRaiz: '34567890', aliases: ['HB'], ativo: true },
  { id: 4, name: 'HUESKER BRASIL LTDA', cnpj: '45.678.901/0001-23', cnpjRaiz: '45678901', aliases: ['HUESKER'], ativo: true },
  { id: 5, name: 'GV COMERCIO EXTERIOR LTDA', cnpj: '56.789.012/0001-34', cnpjRaiz: '56789012', aliases: ['GV'], ativo: true },
];

// Registros já "capturados" (existem em `captacoes`) — referenciados pelos
// CockpitRow.capId abaixo. IDs baixos de propósito, pra não colidir com os
// que o usuário cria durante a sessão de demo (mockNextId começa em 100).
export const mockCaptacoes: Captacao[] = [
  {
    id: 1, cli: 'TECNO', referencia: 'TECNO AMERICA 0347-26', eta: isoDaysFromNow(1), regime: 'DTA',
    bl: 'HBCN066406', ce: '150726001234-5', container: 'TCNU4455210', quantidade: 2, navio: 'MSC AMALFI',
    despachante: 'LOGMAIS', terminalDescarga: 'Santos Brasil', terminalCaptado: 'ECOPORTO',
    observacao: null, cnpj: '23.456.789/0001-01', stage: 'MANIFESTADA', docBl: true, docCe: true, docPl: false,
    docRecebidaEm: isoDaysFromNow(-1), prejuizoPublico: false, dateLabel: null, createdAt: isoDaysFromNow(-2),
  },
  {
    id: 2, cli: 'ALUZEN', referencia: 'ALUZEN NA140966-26', eta: isoDaysFromNow(-3), regime: 'DUIMP',
    bl: 'ALZ2200147', ce: '150726009988-1', container: 'MSCU7183340', quantidade: 3, navio: 'MSC NAOMI',
    despachante: 'NIRRON', terminalDescarga: 'Santos Brasil', terminalCaptado: 'ECOPORTO',
    observacao: null, cnpj: '12.345.678/0001-90', stage: 'EFETIVA', docBl: true, docCe: true, docPl: true,
    docRecebidaEm: isoDaysFromNow(-4), prejuizoPublico: false, dateLabel: null, createdAt: isoDaysFromNow(-6),
  },
  {
    id: 3, cli: 'HB', referencia: 'HB TINTAS 0308-26', eta: isoDaysFromNow(-88), regime: 'DI',
    bl: 'HBTV0041188', ce: '150726004411-2', container: 'HBTU9012345', quantidade: 1, navio: 'SEATTLE BRIDGE',
    despachante: 'LOGMAIS', terminalDescarga: 'DPW', terminalCaptado: 'ECOPORTO',
    observacao: null, cnpj: '34.567.890/0001-12', stage: 'SAIU_TERMINAL', docBl: true, docCe: true, docPl: true,
    docRecebidaEm: isoDaysFromNow(-90), prejuizoPublico: false, dateLabel: null, createdAt: isoDaysFromNow(-91),
  },
];

// Radar completo (embarques × captações já casados) — o que GET /carteira
// devolveria pronto. capId aponta pra um id de mockCaptacoes quando já
// existe captação; null quando ainda é só embarque aguardando captação.
export const mockCarteira: CockpitRow[] = [
  {
    cnpj: '', cli: 'GV', ref: 'GV 0374-26', eta: isoDaysFromNow(1), regime: '', ce: '', bl: 'GVBL0055102',
    navio: 'EVER GIVEN', cont: 'GVCU1122334', qtd: '1', desp: '', atrac: 'Santos Brasil', parc: 'ECOPORTO',
    stage: 'MANIFESTADA_DOCS', capId: null, createdAt: isoDaysFromNow(-1),
  },
  {
    cnpj: '', cli: 'GV', ref: 'GV 0258-26', eta: isoDaysFromNow(-1), regime: 'AGUARDANDO', ce: '', bl: '',
    navio: 'CMA CGM TITAN', cont: '', qtd: '2', desp: '', atrac: 'BTP', parc: 'MOVECTA',
    stage: 'NENHUM', capId: null, createdAt: isoDaysFromNow(-3),
  },
  {
    cnpj: '', cli: 'HUESKER', ref: 'HUESKER 0110-26', eta: isoDaysFromNow(5), regime: 'DTA', ce: '',
    bl: 'HKBL0091823', navio: 'HAPAG EXPRESS', cont: 'HKCU3344556', qtd: '4', desp: 'ATHENA',
    atrac: 'DPW', parc: 'DPW', stage: 'NENHUM', capId: null, createdAt: isoDaysFromNow(-1),
  },
  {
    cnpj: '23.456.789/0001-01', cli: 'TECNO', ref: 'TECNO AMERICA 0347-26', eta: isoDaysFromNow(1),
    regime: 'DTA', ce: '150726001234-5', bl: 'HBCN066406', navio: 'MSC AMALFI', cont: 'TCNU4455210',
    qtd: '2', desp: 'LOGMAIS', atrac: 'Santos Brasil', parc: 'ECOPORTO', stage: 'MANIFESTADA_PARC', capId: 1,
    createdAt: isoDaysFromNow(-2), // igual ao createdAt de mockCaptacoes[0] (mesmo id)
  },
  {
    cnpj: '12.345.678/0001-90', cli: 'ALUZEN', ref: 'ALUZEN NA140966-26', eta: isoDaysFromNow(-3),
    regime: 'DUIMP', ce: '150726009988-1', bl: 'ALZ2200147', navio: 'MSC NAOMI', cont: 'MSCU7183340',
    qtd: '3', desp: 'NIRRON', atrac: 'Santos Brasil', parc: 'ECOPORTO', stage: 'EFETIVA', capId: 2,
    createdAt: isoDaysFromNow(-6), // igual ao createdAt de mockCaptacoes[1]
  },
  {
    cnpj: '34.567.890/0001-12', cli: 'HB', ref: 'HB TINTAS 0308-26', eta: isoDaysFromNow(-88),
    regime: 'DI', ce: '150726004411-2', bl: 'HBTV0041188', navio: 'SEATTLE BRIDGE', cont: 'HBTU9012345',
    qtd: '1', desp: 'LOGMAIS', atrac: 'DPW', parc: 'ECOPORTO', stage: 'SAIU', capId: 3,
    createdAt: isoDaysFromNow(-91), // igual ao createdAt de mockCaptacoes[2]
  },
  {
    cnpj: '', cli: 'FASTER', ref: 'FASTER 0902-26', eta: isoDaysFromNow(14), regime: '', ce: '', bl: '',
    navio: 'ONE INNOVATION', cont: '', qtd: '1', desp: '', atrac: 'BTP', parc: 'MOVECTA',
    stage: 'NENHUM', capId: null, createdAt: isoDaysFromNow(-5),
  },
];
