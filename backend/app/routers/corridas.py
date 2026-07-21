"""Registro rapido de corridas individuais."""
from collections import defaultdict
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Corrida, User
from ..schemas import CorridaCreate, CorridaOut, CorridasHoje

router = APIRouter(prefix="/api/corridas", tags=["corridas"])


@router.get("", response_model=list[CorridaOut])
def listar(
    data: date_type | None = Query(None),
    limite: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Corrida).where(Corrida.usuario_id == user.id)
    if data:
        stmt = stmt.where(Corrida.data == data)
    stmt = stmt.order_by(Corrida.criado_em.desc()).limit(limite)
    return db.scalars(stmt).all()


@router.get("/resumo", response_model=CorridasHoje)
def resumo(
    data: date_type | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dia = data or date_type.today()
    corridas = db.scalars(
        select(Corrida).where(Corrida.usuario_id == user.id, Corrida.data == dia)
    ).all()
    por_plat: dict[str, float] = defaultdict(float)
    for c in corridas:
        por_plat[c.plataforma] += c.valor
    return CorridasHoje(
        data=dia,
        total=round(sum(c.valor for c in corridas), 2),
        num_corridas=len(corridas),
        por_plataforma=dict(por_plat),
    )


@router.post("", response_model=CorridaOut, status_code=201)
def criar(dados: CorridaCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = Corrida(usuario_id=user.id, **dados.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{corrida_id}", status_code=204)
def remover(corrida_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(Corrida, corrida_id)
    if not c or c.usuario_id != user.id:
        raise HTTPException(status_code=404, detail="Corrida nao encontrada")
    db.delete(c)
    db.commit()
