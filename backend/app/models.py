"""Modelos do banco (SQLAlchemy)."""
import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "usuarios"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    nome: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    senha_hash: Mapped[str] = mapped_column(String, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    jornadas: Mapped[list["Jornada"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")
    gastos: Mapped[list["Gasto"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")
    metas: Mapped[list["Meta"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")


class Jornada(Base):
    """Um dia (ou turno) de trabalho."""
    __tablename__ = "jornadas"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)

    data: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    inicio: Mapped[time | None] = mapped_column(Time, nullable=True)
    fim: Mapped[time | None] = mapped_column(Time, nullable=True)
    km_rodado: Mapped[float] = mapped_column(Float, default=0.0)
    ganho_bruto: Mapped[float] = mapped_column(Float, default=0.0)
    num_corridas: Mapped[int] = mapped_column(Integer, default=0)
    plataforma: Mapped[str | None] = mapped_column(String, nullable=True)  # uber / 99 / indrive / mista
    observacao: Mapped[str | None] = mapped_column(String, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    usuario: Mapped["User"] = relationship(back_populates="jornadas")


class Corrida(Base):
    """Uma corrida individual — registro rapido durante o turno."""
    __tablename__ = "corridas"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)

    valor: Mapped[float] = mapped_column(Float, nullable=False)
    plataforma: Mapped[str] = mapped_column(String, default="uber")  # uber / 99 / indrive / outra
    km: Mapped[float] = mapped_column(Float, default=0.0)
    data: Mapped[date] = mapped_column(Date, nullable=False, index=True)  # data local do cliente
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Config(Base):
    """Configuracao de custos do motorista (por usuario)."""
    __tablename__ = "configs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), unique=True, index=True)

    preco_combustivel: Mapped[float] = mapped_column(Float, default=5.80)   # R$/litro
    consumo_km_l: Mapped[float] = mapped_column(Float, default=10.0)        # km por litro
    manutencao_por_km: Mapped[float] = mapped_column(Float, default=0.15)   # desgaste R$/km
    custo_fixo_diario: Mapped[float] = mapped_column(Float, default=0.0)    # aluguel/parcela por dia
    meta_lucro_por_km: Mapped[float] = mapped_column(Float, default=0.0)    # opcional: alvo R$/km


class Turno(Base):
    """Turno de trabalho — cronometro. Fonte real das horas trabalhadas."""
    __tablename__ = "turnos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)

    inicio: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    fim: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    data: Mapped[date] = mapped_column(Date, nullable=False, index=True)  # data local do cliente


class Gasto(Base):
    __tablename__ = "gastos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)

    categoria: Mapped[str] = mapped_column(String, nullable=False)  # combustivel, alimentacao, pedagio...
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    descricao: Mapped[str | None] = mapped_column(String, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    usuario: Mapped["User"] = relationship(back_populates="gastos")


class Meta(Base):
    __tablename__ = "metas"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)

    periodo: Mapped[str] = mapped_column(String, nullable=False)  # diaria / semanal / mensal
    valor_alvo: Mapped[float] = mapped_column(Float, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    usuario: Mapped["User"] = relationship(back_populates="metas")
