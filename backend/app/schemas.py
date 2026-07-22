"""Schemas Pydantic (validacao de entrada/saida da API)."""
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ----- Auth -----
class UserCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    email: EmailStr
    senha: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    senha: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    nome: str
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ----- Jornada -----
class JornadaBase(BaseModel):
    data: date
    inicio: time | None = None
    fim: time | None = None
    km_rodado: float = 0.0
    ganho_bruto: float = 0.0
    num_corridas: int = 0
    plataforma: str | None = None
    observacao: str | None = None


class JornadaCreate(JornadaBase):
    pass


class JornadaUpdate(BaseModel):
    data: date | None = None
    inicio: time | None = None
    fim: time | None = None
    km_rodado: float | None = None
    ganho_bruto: float | None = None
    num_corridas: int | None = None
    plataforma: str | None = None
    observacao: str | None = None


class JornadaOut(JornadaBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    horas_trabalhadas: float | None = None


# ----- Corrida -----
class CorridaCreate(BaseModel):
    valor: float = Field(gt=0)
    plataforma: str = "uber"
    km: float = 0.0
    data: date


class CorridaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    valor: float
    plataforma: str
    km: float
    data: date
    criado_em: datetime


class CorridasHoje(BaseModel):
    data: date
    total: float
    num_corridas: int
    por_plataforma: dict[str, float]


# ----- Config / custo real -----
class ConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    preco_combustivel: float
    consumo_km_l: float
    manutencao_por_km: float
    custo_fixo_diario: float
    meta_lucro_por_km: float
    custo_por_km: float = 0.0  # calculado: combustivel/consumo + manutencao


class ConfigUpdate(BaseModel):
    preco_combustivel: float | None = Field(default=None, gt=0)
    consumo_km_l: float | None = Field(default=None, gt=0)
    manutencao_por_km: float | None = Field(default=None, ge=0)
    custo_fixo_diario: float | None = Field(default=None, ge=0)
    meta_lucro_por_km: float | None = Field(default=None, ge=0)


class ValeAPenaIn(BaseModel):
    valor: float = Field(gt=0)
    km: float = Field(gt=0)
    minutos: float | None = Field(default=None, ge=0)


class ValeAPenaOut(BaseModel):
    valor: float
    km: float
    custo_estimado: float
    lucro_estimado: float
    valor_por_km: float
    custo_por_km: float
    veredito: str  # "prejuizo" | "ok" | "otimo"
    r_por_hora: float | None = None


class PlataformaComparacao(BaseModel):
    plataforma: str
    total: float
    num_corridas: int
    km: float
    r_por_corrida: float
    r_por_km: float
    percentual: float  # fatia do ganho total (0..1)


# ----- Turno -----
class TurnoIniciar(BaseModel):
    data: date | None = None


class TurnoUpdate(BaseModel):
    km: float | None = Field(default=None, ge=0)
    pontos: list | None = None


class TurnoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    inicio: datetime
    fim: datetime | None
    data: date
    km: float = 0.0
    pontos: list | None = None


# ----- Gasto -----
class GastoBase(BaseModel):
    categoria: str
    valor: float
    data: date
    descricao: str | None = None


class GastoCreate(GastoBase):
    pass


class GastoUpdate(BaseModel):
    categoria: str | None = None
    valor: float | None = None
    data: date | None = None
    descricao: str | None = None


class GastoOut(GastoBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ----- Meta -----
class MetaBase(BaseModel):
    periodo: str  # diaria / semanal / mensal
    valor_alvo: float
    ativo: bool = True


class MetaCreate(MetaBase):
    pass


class MetaUpdate(BaseModel):
    periodo: str | None = None
    valor_alvo: float | None = None
    ativo: bool | None = None


class MetaOut(MetaBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ----- Agenda (calendario de planejamento) -----
class AgendaUpsert(BaseModel):
    data: date
    trabalhar: bool = True
    horas_alvo: float = Field(default=0.0, ge=0, le=24)
    nota: str | None = None


class AgendaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    data: date
    trabalhar: bool
    horas_alvo: float
    nota: str | None = None


class AgendaBulk(BaseModel):
    datas: list[date]
    trabalhar: bool = True
    horas_alvo: float = Field(default=0.0, ge=0, le=24)
    limpar: bool = False  # se True, remove os dias (ignora trabalhar/horas)


class AgendaResumo(BaseModel):
    inicio: date
    fim: date
    dias_planejados: int      # dias marcados para trabalhar
    dias_folga: int           # dias marcados como folga
    horas_planejadas: float   # soma das horas_alvo dos dias de trabalho
    media_horas: float        # horas_planejadas / dias_planejados


# ----- Dashboard -----
class DashboardResumo(BaseModel):
    periodo: str
    inicio: date
    fim: date
    ganho_bruto: float
    total_gastos: float
    lucro_liquido: float
    horas_trabalhadas: float
    km_rodado: float
    num_corridas: int
    dias_trabalhados: int
    lucro_por_hora: float
    lucro_por_km: float
    ganho_por_corrida: float
    meta_valor: float | None = None
    meta_progresso: float | None = None  # 0..1
