// Espelham as respostas da captacao-api — ver
// migration-plan/comparison/API_COMPARISON.md.

export interface Cliente {
  id: number;
  name: string;
  cnpj: string | null;
  cnpjRaiz: string | null;
  aliases: string[];
  ativo: boolean;
}

export interface Captacao {
  id: number;
  cli: string | null;
  referencia: string | null;
  eta: string | null;
  regime: string | null;
  bl: string | null;
  ce: string | null;
  container: string | null;
  quantidade: number | null;
  navio: string | null;
  despachante: string | null;
  terminalDescarga: string | null;
  terminalCaptado: string | null;
  observacao: string | null;
  cnpj: string | null;
  stage: string | null;
  docBl: boolean | null;
  docCe: boolean | null;
  docPl: boolean | null;
  docRecebidaEm: string | null;
  prejuizoPublico: boolean | null;
  dateLabel: string | null;
  createdAt: string;
}

// Devolvido por GET /carteira — já casado e classificado pelo backend
// (domain/cockpit.ts). Ver migration-plan/comparison/API_COMPARISON.md.
export interface CockpitRow {
  cnpj: string;
  cli: string;
  ref: string;
  eta: string;
  regime: string;
  ce: string;
  bl: string;
  navio: string;
  cont: string;
  qtd: string;
  desp: string;
  atrac: string;
  parc: string;
  stage: 'NENHUM' | 'SAIU' | 'EFETIVA' | 'MANIFESTADA_DOCS' | 'MANIFESTADA_PARC';
  capId: number | null;
  prov?: boolean;
}

// Corpo aceito por POST/PATCH /captacoes — ver
// migration-plan/comparison/API_COMPARISON.md.
export interface CaptacaoInput {
  cli?: string;
  referencia?: string;
  eta?: string;
  regime?: string;
  bl?: string;
  ce?: string;
  container?: string;
  quantidade?: number;
  navio?: string;
  despachante?: string;
  terminalDescarga?: string;
  terminalCaptado?: string;
  observacao?: string;
  cnpj?: string;
  efetivada?: boolean;
  docBl?: boolean;
  docCe?: boolean;
  docPl?: boolean;
  prejuizoPublico?: boolean;
}
