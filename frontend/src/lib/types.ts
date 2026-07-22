export type Papel = "motorista" | "locadora";

export interface User {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
}

export interface Aluguel {
  id: string;
  motorista_email: string;
  motorista_nome: string | null;
  vinculado: boolean;
  carro: string | null;
  valor: number;
  periodicidade: "semanal" | "mensal";
  dia_vencimento: number;
  ativo: boolean;
  prox_vencimento: string | null;
  dias_restantes: number | null;
  status: "em_dia" | "pendente" | "atrasado" | "inativo";
  ultimo_pagamento: string | null;
}

export interface PagamentoAluguel {
  id: string;
  data: string;
  valor: number;
  competencia: string;
}

export interface LocadoraResumo {
  alugueis_ativos: number;
  receita_mensal_prevista: number;
  a_vencer_7dias: number;
  atrasados: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Jornada {
  id: string;
  data: string;
  inicio: string | null;
  fim: string | null;
  km_rodado: number;
  ganho_bruto: number;
  num_corridas: number;
  plataforma: string | null;
  observacao: string | null;
  horas_trabalhadas: number | null;
}

export interface Corrida {
  id: string;
  valor: number;
  plataforma: string;
  km: number;
  data: string;
  criado_em: string;
}

export type Ponto = [number, number]; // [lat, lng]

export interface Turno {
  id: string;
  inicio: string;
  fim: string | null;
  data: string;
  km: number;
  pontos: Ponto[] | null;
}

export interface Gasto {
  id: string;
  categoria: string;
  valor: number;
  data: string;
  descricao: string | null;
}

export interface Meta {
  id: string;
  periodo: "diaria" | "semanal" | "mensal";
  valor_alvo: number;
  ativo: boolean;
}

export interface AgendaDia {
  id: string;
  data: string; // YYYY-MM-DD
  trabalhar: boolean;
  horas_alvo: number;
  nota: string | null;
}

export interface AgendaResumo {
  inicio: string;
  fim: string;
  dias_planejados: number;
  dias_folga: number;
  horas_planejadas: number;
  media_horas: number;
}

export interface Config {
  preco_combustivel: number;
  consumo_km_l: number;
  manutencao_por_km: number;
  custo_fixo_diario: number;
  meta_lucro_por_km: number;
  custo_por_km: number;
}

export interface ValeAPena {
  valor: number;
  km: number;
  custo_estimado: number;
  lucro_estimado: number;
  valor_por_km: number;
  custo_por_km: number;
  veredito: "prejuizo" | "ok" | "otimo";
  r_por_hora: number | null;
}

export interface PlataformaComparacao {
  plataforma: string;
  total: number;
  num_corridas: number;
  km: number;
  r_por_corrida: number;
  r_por_km: number;
  percentual: number;
}

export interface SerieDia {
  data: string; // YYYY-MM-DD
  ganho: number;
  gastos: number;
  lucro: number;
  corridas: number;
}

export interface Insight {
  nivel: "critico" | "atencao" | "bom" | "info";
  icone: string;
  titulo: string;
  texto: string;
}

export interface DashboardResumo {
  periodo: string;
  inicio: string;
  fim: string;
  ganho_bruto: number;
  total_gastos: number;
  lucro_liquido: number;
  horas_trabalhadas: number;
  km_rodado: number;
  num_corridas: number;
  dias_trabalhados: number;
  lucro_por_hora: number;
  lucro_por_km: number;
  ganho_por_corrida: number;
  meta_valor: number | null;
  meta_progresso: number | null;
}
