"""CRUD de jornadas (dias/turnos de trabalho)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Jornada, User
from ..schemas import JornadaCreate, JornadaOut, JornadaUpdate
from ..utils import horas_trabalhadas

router = APIRouter(prefix="/api/jornadas", tags=["jornadas"])


def _to_out(j: Jornada) -> JornadaOut:
    out = JornadaOut.model_validate(j)
    out.horas_trabalhadas = horas_trabalhadas(j.inicio, j.fim)
    return out


@router.get("", response_model=list[JornadaOut])
def listar(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limite: int = 60,
):
    stmt = (
        select(Jornada)
        .where(Jornada.usuario_id == user.id)
        .order_by(Jornada.data.desc(), Jornada.criado_em.desc())
        .limit(limite)
    )
    return [_to_out(j) for j in db.scalars(stmt).all()]


@router.post("", response_model=JornadaOut, status_code=201)
def criar(dados: JornadaCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    j = Jornada(usuario_id=user.id, **dados.model_dump())
    db.add(j)
    db.commit()
    db.refresh(j)
    return _to_out(j)


@router.patch("/{jornada_id}", response_model=JornadaOut)
def atualizar(
    jornada_id: str,
    dados: JornadaUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    j = db.get(Jornada, jornada_id)
    if not j or j.usuario_id != user.id:
        raise HTTPException(status_code=404, detail="Jornada nao encontrada")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(j, campo, valor)
    db.commit()
    db.refresh(j)
    return _to_out(j)


@router.delete("/{jornada_id}", status_code=204)
def remover(jornada_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    j = db.get(Jornada, jornada_id)
    if not j or j.usuario_id != user.id:
        raise HTTPException(status_code=404, detail="Jornada nao encontrada")
    db.delete(j)
    db.commit()
