"""Modelos do banco (SQLAlchemy)."""
import uuid
from datetime import date, datetime, time

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Time, UniqueConstraint, func
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
    papel: Mapped[str] = mapped_column(String, default="motorista")  # motorista | locadora
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
    km: Mapped[float] = mapped_column(Float, default=0.0)  # distancia pelo GPS
    pontos: Mapped[list | None] = mapped_column(JSON, nullable=True)  # tracado [[lat,lng],...]


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


class Carro(Base):
    """Um carro do catalogo de uma locadora. Fica indisponivel enquanto tem
    um aluguel ativo vinculado a ele."""
    __tablename__ = "carros"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    locadora_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)

    modelo: Mapped[str] = mapped_column(String, nullable=False)     # ex: "Chevrolet Onix 2022"
    placa: Mapped[str | None] = mapped_column(String, nullable=True)
    cor: Mapped[str | None] = mapped_column(String, nullable=True)
    ano: Mapped[int | None] = mapped_column(Integer, nullable=True)
    km: Mapped[int | None] = mapped_column(Integer, nullable=True)          # odometro
    combustivel: Mapped[str | None] = mapped_column(String, nullable=True)  # flex / gnv / etc
    valor_sugerido: Mapped[float | None] = mapped_column(Float, nullable=True)  # aluguel sugerido
    observacao: Mapped[str | None] = mapped_column(String, nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Aluguel(Base):
    """Aluguel de carro que uma locadora atribui a um motorista (pelo e-mail).
    O motorista, se tiver conta com esse e-mail, ve o aluguel no app dele."""
    __tablename__ = "alugueis"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    locadora_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    motorista_email: Mapped[str] = mapped_column(String, index=True)
    motorista_id: Mapped[str | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True, index=True)

    carro: Mapped[str | None] = mapped_column(String, nullable=True)   # texto (legado/exibicao)
    carro_id: Mapped[str | None] = mapped_column(ForeignKey("carros.id"), nullable=True, index=True)
    carro_desejado_id: Mapped[str | None] = mapped_column(ForeignKey("carros.id"), nullable=True)  # troca pedida
    troca_status: Mapped[str | None] = mapped_column(String, nullable=True)  # None | "solicitada"
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    periodicidade: Mapped[str] = mapped_column(String, default="semanal")  # semanal | mensal
    dia_vencimento: Mapped[int] = mapped_column(Integer, default=1)    # semanal: 0=Seg..6=Dom / mensal: 1..31
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class PagamentoAluguel(Base):
    """Um pagamento registrado pela locadora para um aluguel."""
    __tablename__ = "pagamentos_aluguel"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    aluguel_id: Mapped[str] = mapped_column(ForeignKey("alugueis.id"), index=True)
    data: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    competencia: Mapped[str] = mapped_column(String, nullable=False)  # "2026-07" ou "2026-W30"
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Agenda(Base):
    """Planejamento do calendario: para cada dia, se o motorista pretende
    trabalhar e quantas horas quer rodar. Um registro por (usuario, data)."""
    __tablename__ = "agenda"
    __table_args__ = (UniqueConstraint("usuario_id", "data", name="uq_agenda_user_data"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)

    data: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    trabalhar: Mapped[bool] = mapped_column(Boolean, default=True)   # True = dia de trabalho / False = folga
    horas_alvo: Mapped[float] = mapped_column(Float, default=0.0)    # horas que pretende rodar no dia
    nota: Mapped[str | None] = mapped_column(String, nullable=True)  # anotacao livre (opcional)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Conta(Base):
    """Compromisso financeiro recorrente: financiamento, aluguel, seguro, cartão..."""
    __tablename__ = "contas"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)

    descricao: Mapped[str] = mapped_column(String, nullable=False)
    categoria: Mapped[str] = mapped_column(String, default="financiamento")
    valor_parcela: Mapped[float] = mapped_column(Float, nullable=False)
    total_parcelas: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = recorrente sem fim
    parcelas_pagas: Mapped[int] = mapped_column(Integer, default=0)
    dia_vencimento: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1..31
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Meta(Base):
    __tablename__ = "metas"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)

    periodo: Mapped[str] = mapped_column(String, nullable=False)  # diaria / semanal / mensal
    valor_alvo: Mapped[float] = mapped_column(Float, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    usuario: Mapped["User"] = relationship(back_populates="metas")
