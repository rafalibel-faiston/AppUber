"""Schemas Pydantic (validacao de entrada/saida da API)."""
from datetime import date, time

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
