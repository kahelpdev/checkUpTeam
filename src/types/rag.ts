// Tipos do endpoint /api/relatorios/rag-query.
//
// Estes contratos são consumidos pelo frontend e pelos testes em
// tests/rag/recall.test.ts. Mudanças aqui são breaking — coordenar.

export interface RagQueryFilters {
  equipe?: string;
  dataInicio?: string;  // ISO date (YYYY-MM-DD)
  dataFim?: string;     // ISO date (YYYY-MM-DD)
}

export interface RagQueryRequest {
  question: string;
  topK?: number;        // default 10, max 50
  filters?: RagQueryFilters;
}

export interface RagSource {
  id: string;
  equipe: string;
  nome: string;
  dataDia: string;      // YYYY-MM-DD
  score: number;        // 1 - cosine_distance ∈ [0, 1]; quanto maior, mais similar
}

export interface RagQueryResponse {
  answer: string;
  sources: RagSource[];
  modelo: string;
  retrievalCount: number;
}
