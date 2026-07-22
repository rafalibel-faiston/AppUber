"""Agenda / calendario de planejamento do motorista.

Cada dia pode ter um plano: trabalhar (com uma meta de horas) ou folga.
Um registro por (usuario, data) — o PUT faz upsert.
"""
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Agenda, User
from ..schemas import AgendaBulk, AgendaOut, AgendaResumo, AgendaUpsert

router = APIRouter(prefix="/api/agenda", tags=["agenda"])


@router.get("", response_model=list[AgendaOut])
def listar(
    inicio: date_type | None = Query(None),
    fim: date_type | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Agenda).where(Agenda.usuario_id == user.id)
    if inicio:
        stmt = stmt.where(Agenda.data >= inicio)
    if fim:
        stmt = stmt.where(Agenda.data <= fim)
    stmt = stmt.order_by(Agenda.data.asc())
    return db.scalars(stmt).all()


@router.get("/resumo", response_model=AgendaResumo)
def resumo(
    inicio: date_type = Query(...),
    fim: date_type = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dias = db.scalars(
        select(Agenda).where(
            Agenda.usuario_id == user.id,
            Agenda.data >= inicio,
            Agenda.data <= fim,
        )
    ).all()
    trabalho = [d for d in dias if d.trabalhar]
    folga = [d for d in dias if not d.trabalhar]
    horas = round(sum(d.horas_alvo for d in trabalho), 1)
    media = round(horas / len(trabalho), 1) if trabalho else 0.0
    return AgendaResumo(
        inicio=inicio,
        fim=fim,
        dias_planejados=len(trabalho),
        dias_folga=len(folga),
        horas_planejadas=horas,
        media_horas=media,
    )


@router.post("/bulk", response_model=list[AgendaOut])
def bulk(dados: AgendaBulk, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Aplica o mesmo plano a varios dias de uma vez (pincel/arrastar).

    - limpar=True remove os dias informados.
    - senao, faz upsert de cada dia com trabalhar/horas_alvo.
    """
    if not dados.datas:
        return []

    existentes = {
        d.data: d
        for d in db.scalars(
            select(Agenda).where(Agenda.usuario_id == user.id, Agenda.data.in_(dados.datas))
        ).all()
    }

    if dados.limpar:
        for d in existentes.values():
            db.delete(d)
        db.commit()
        return []

    horas = dados.horas_alvo if dados.trabalhar else 0.0
    resultado: list[Agenda] = []
    for dt in dados.datas:
        e = existentes.get(dt)
        if e:
            e.trabalhar = dados.trabalhar
            e.horas_alvo = horas
        else:
            e = Agenda(usuario_id=user.id, data=dt, trabalhar=dados.trabalhar, horas_alvo=horas)
            db.add(e)
        resultado.append(e)
    db.commit()
    for e in resultado:
        db.refresh(e)
    return resultado


@router.put("", response_model=AgendaOut)
def upsert(dados: AgendaUpsert, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Cria ou atualiza o plano de um dia (upsert por data)."""
    existente = db.scalar(
        select(Agenda).where(Agenda.usuario_id == user.id, Agenda.data == dados.data)
    )
    if existente:
        existente.trabalhar = dados.trabalhar
        existente.horas_alvo = dados.horas_alvo
        existente.nota = dados.nota
        db.commit()
        db.refresh(existente)
        return existente

    novo = Agenda(usuario_id=user.id, **dados.model_dump())
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


@router.delete("/{data}", status_code=204)
def limpar(data: date_type, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Remove o plano de um dia (volta a ficar 'sem plano')."""
    dia = db.scalar(
        select(Agenda).where(Agenda.usuario_id == user.id, Agenda.data == data)
    )
    if not dia:
        raise HTTPException(status_code=404, detail="Dia sem plano")
    db.delete(dia)
    db.commit()
