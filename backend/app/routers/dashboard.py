"""Resumo financeiro consolidado para o dashboard."""
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Corrida, Gasto, Meta, User
from ..schemas import DashboardResumo
from ..utils import intervalo_periodo

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/resumo", response_model=DashboardResumo)
def resumo(
    periodo: str = Query("semanal", pattern="^(diaria|semanal|mensal)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    inicio, fim = intervalo_periodo(periodo)

    corridas = db.scalars(
        select(Corrida).where(
            Corrida.usuario_id == user.id,
            Corrida.data >= inicio,
            Corrida.data <= fim,
        )
    ).all()

    ganho_bruto = sum(c.valor for c in corridas)
    km = sum(c.km for c in corridas)
    num_corridas = len(corridas)

    # Horas trabalhadas derivadas: por dia, intervalo entre a 1a e a ultima corrida.
    por_dia: dict = defaultdict(list)
    for c in corridas:
        if c.criado_em:
            por_dia[c.data].append(c.criado_em)
    horas = 0.0
    for _dia, times in por_dia.items():
        if len(times) >= 2:
            horas += (max(times) - min(times)).total_seconds() / 3600
    dias = len(por_dia)

    total_gastos = db.scalar(
        select(func.coalesce(func.sum(Gasto.valor), 0.0)).where(
            Gasto.usuario_id == user.id,
            Gasto.data >= inicio,
            Gasto.data <= fim,
        )
    ) or 0.0

    lucro = ganho_bruto - total_gastos

    meta = db.scalar(
        select(Meta).where(
            Meta.usuario_id == user.id,
            Meta.periodo == periodo,
            Meta.ativo.is_(True),
        ).order_by(Meta.criado_em.desc())
    )
    meta_valor = meta.valor_alvo if meta else None
    meta_progresso = None
    if meta_valor and meta_valor > 0:
        meta_progresso = round(max(lucro, 0) / meta_valor, 4)

    return DashboardResumo(
        periodo=periodo,
        inicio=inicio,
        fim=fim,
        ganho_bruto=round(ganho_bruto, 2),
        total_gastos=round(float(total_gastos), 2),
        lucro_liquido=round(lucro, 2),
        horas_trabalhadas=round(horas, 2),
        km_rodado=round(km, 2),
        num_corridas=num_corridas,
        dias_trabalhados=dias,
        lucro_por_hora=round(lucro / horas, 2) if horas > 0 else 0.0,
        lucro_por_km=round(lucro / km, 2) if km > 0 else 0.0,
        ganho_por_corrida=round(ganho_bruto / num_corridas, 2) if num_corridas > 0 else 0.0,
        meta_valor=meta_valor,
        meta_progresso=meta_progresso,
    )
