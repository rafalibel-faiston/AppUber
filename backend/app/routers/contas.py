"""Contas e financiamentos do motorista."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Conta, User
from ..schemas import ContaCreate, ContaOut, ContasResumo, ContaUpdate

router = APIRouter(prefix="/api/contas", tags=["contas"])


def _to_out(c: Conta) -> ContaOut:
    out = ContaOut.model_validate(c)
    if c.total_parcelas is not None:
        restantes = max(c.total_parcelas - c.parcelas_pagas, 0)
        out.parcelas_restantes = restantes
        out.valor_restante = round(restantes * c.valor_parcela, 2)
        out.quitada = restantes == 0
    return out


@router.get("", response_model=list[ContaOut])
def listar(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(Conta).where(Conta.usuario_id == user.id).order_by(Conta.criado_em.desc())
    return [_to_out(c) for c in db.scalars(stmt).all()]


@router.get("/resumo", response_model=ContasResumo)
def resumo(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    contas = db.scalars(
        select(Conta).where(Conta.usuario_id == user.id, Conta.ativo.is_(True))
    ).all()
    total_mensal = 0.0
    total_restante = 0.0
    for c in contas:
        quitada = c.total_parcelas is not None and c.parcelas_pagas >= c.total_parcelas
        if not quitada:
            total_mensal += c.valor_parcela
        if c.total_parcelas is not None:
            total_restante += max(c.total_parcelas - c.parcelas_pagas, 0) * c.valor_parcela
    return ContasResumo(
        total_mensal=round(total_mensal, 2),
        total_restante=round(total_restante, 2),
        num_ativas=len(contas),
    )


@router.post("", response_model=ContaOut, status_code=201)
def criar(dados: ContaCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = Conta(usuario_id=user.id, **dados.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _to_out(c)


@router.post("/{conta_id}/pagar", response_model=ContaOut)
def pagar_parcela(conta_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(Conta, conta_id)
    if not c or c.usuario_id != user.id:
        raise HTTPException(status_code=404, detail="Conta nao encontrada")
    if c.total_parcelas is None or c.parcelas_pagas < c.total_parcelas:
        c.parcelas_pagas += 1
    db.commit()
    db.refresh(c)
    return _to_out(c)


@router.patch("/{conta_id}", response_model=ContaOut)
def atualizar(
    conta_id: str, dados: ContaUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    c = db.get(Conta, conta_id)
    if not c or c.usuario_id != user.id:
        raise HTTPException(status_code=404, detail="Conta nao encontrada")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(c, campo, valor)
    db.commit()
    db.refresh(c)
    return _to_out(c)


@router.delete("/{conta_id}", status_code=204)
def remover(conta_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(Conta, conta_id)
    if not c or c.usuario_id != user.id:
        raise HTTPException(status_code=404, detail="Conta nao encontrada")
    db.delete(c)
    db.commit()
