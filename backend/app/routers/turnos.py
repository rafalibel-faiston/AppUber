"""Cronometro de turno — fonte real das horas trabalhadas."""
from datetime import date as date_type
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Turno, User
from ..schemas import TurnoIniciar, TurnoOut

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


@router.post("/encerrar", response_model=TurnoOut)
def encerrar(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = _aberto(db, user.id)
    if not t:
        raise HTTPException(status_code=404, detail="Nenhum turno em andamento")
    t.fim = datetime.utcnow()
    db.commit()
    db.refresh(t)
    return t
