"""CRUD de metas."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Meta, User
from ..schemas import MetaCreate, MetaOut, MetaUpdate

router = APIRouter(prefix="/api/metas", tags=["metas"])


@router.get("", response_model=list[MetaOut])
def listar(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(Meta).where(Meta.usuario_id == user.id).order_by(Meta.criado_em.desc())
    return db.scalars(stmt).all()


@router.post("", response_model=MetaOut, status_code=201)
def criar(dados: MetaCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = Meta(usuario_id=user.id, **dados.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.patch("/{meta_id}", response_model=MetaOut)
def atualizar(
    meta_id: str,
    dados: MetaUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    m = db.get(Meta, meta_id)
    if not m or m.usuario_id != user.id:
        raise HTTPException(status_code=404, detail="Meta nao encontrada")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(m, campo, valor)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/{meta_id}", status_code=204)
def remover(meta_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.get(Meta, meta_id)
    if not m or m.usuario_id != user.id:
        raise HTTPException(status_code=404, detail="Meta nao encontrada")
    db.delete(m)
    db.commit()
