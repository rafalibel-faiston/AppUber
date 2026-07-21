"""CRUD de gastos."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Gasto, User
from ..schemas import GastoCreate, GastoOut, GastoUpdate

router = APIRouter(prefix="/api/gastos", tags=["gastos"])


@router.get("", response_model=list[GastoOut])
def listar(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limite: int = 100,
):
    stmt = (
        select(Gasto)
        .where(Gasto.usuario_id == user.id)
        .order_by(Gasto.data.desc(), Gasto.criado_em.desc())
        .limit(limite)
    )
    return db.scalars(stmt).all()


@router.post("", response_model=GastoOut, status_code=201)
def criar(dados: GastoCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    g = Gasto(usuario_id=user.id, **dados.model_dump())
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.patch("/{gasto_id}", response_model=GastoOut)
def atualizar(
    gasto_id: str,
    dados: GastoUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    g = db.get(Gasto, gasto_id)
    if not g or g.usuario_id != user.id:
        raise HTTPException(status_code=404, detail="Gasto nao encontrado")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(g, campo, valor)
    db.commit()
    db.refresh(g)
    return g


@router.delete("/{gasto_id}", status_code=204)
def remover(gasto_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    g = db.get(Gasto, gasto_id)
    if not g or g.usuario_id != user.id:
        raise HTTPException(status_code=404, detail="Gasto nao encontrado")
    db.delete(g)
    db.commit()
