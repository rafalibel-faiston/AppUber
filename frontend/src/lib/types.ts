export interface User {
  id: string;
  nome: string;
  email: string;
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
