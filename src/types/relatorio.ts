export interface RelatorioDiario {
  id: string;
  tipoUsuario: string;
  idColaborador: number;
  nome: string;
  equipe: string;
  dataDia: string;
  comoSeSentiu: string;
  atividadesRealizadas: string;
  impedimentos: string;
  demandasPendenteColaborador: string;
  demandasPendenteLideranca: string;
  entregasPlanejadas: string;
  motivoNaoEntrega: string | null;
  horaExtra: string;
  motivoHoraExtra: string | null;
  tempoHoraExtra: number | null;
  horaExtraAprovada: string | null;
  createdAt: string;
}

export interface RelatorioFilters {
  equipe: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
}
