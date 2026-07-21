"""Cronometro de turno — fonte real das horas trabalhadas."""
from datetime import date as date_type
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Turno, User
from ..schemas import TurnoIniciar, TurnoOut, TurnoUpdate

router = APIRouter(prefix="/api/turnos", tags=["turnos"])


def _aberto(db: Session, user_id: str) -> Turno | None:
    return db.scalar(
        select(Turno).where(Turno.usuario_id == user_id, Turno.fim.is_(None)).order_by(Turno.inicio.desc())
    )


@router.get("/atual", response_model=TurnoOut | None)
def atual(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _aberto(db, user.id)


@router.post("/iniciar", response_model=TurnoOut, status_code=201)
def iniciar(dados: TurnoIniciar, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ja = _aberto(db, user.id)
    if ja:
        return ja  # ja tem turno rodando, devolve ele (idempotente)
    t = Turno(usuario_id=user.id, inicio=datetime.utcnow(), data=dados.data or date_type.today())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.patch("/{turno_id}", response_model=TurnoOut)
def atualizar(
    turno_id: str,
    dados: TurnoUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Autosave da rota/km durante o turno (chamado periodicamente)."""
    t = db.get(Turno, turno_id)
    if not t or t.usuario_id != user.id:
        raise HTTPException(status_code=404, detail="Turno nao encontrado")
    if dados.km is not None:
        t.km = dados.km
    if dados.pontos is not None:
        t.pontos = dados.pontos
    db.commit()
    db.refresh(t)
    return t


@router.post("/encerrar", response_model=TurnoOut)
def encerrar(
    dados: TurnoUpdate | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = _aberto(db, user.id)
    if not t:
        raise HTTPException(status_code=404, detail="Nenhum turno em andamento")
    if dados:
        if dados.km is not None:
            t.km = dados.km
        if dados.pontos is not None:
            t.pontos = dados.pontos
    t.fim = datetime.utcnow()
    db.commit()
    db.refresh(t)
    return t
