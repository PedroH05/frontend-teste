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
