"""Aluguel de carro: locadora atribui a motoristas (por e-mail) e registra
pagamentos; o motorista ve o aluguel dele no app."""
import calendar
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_locadora
from ..models import Aluguel, Carro, PagamentoAluguel, User
from ..schemas import (
    AluguelCreate,
    AluguelOut,
    AluguelUpdate,
    LocadoraResumo,
    PagamentoCreate,
    PagamentoOut,
    TrocaSolicitar,
)

router = APIRouter(prefix="/api/alugueis", tags=["alugueis"])


# ---------- calculo de vencimento/status ----------
def _clamp_dia(ano: int, mes: int, dia: int) -> int:
    ultimo = calendar.monthrange(ano, mes)[1]
    return min(max(dia, 1), ultimo)


def _competencia(hoje: date, periodicidade: str) -> str:
    if periodicidade == "mensal":
        return f"{hoje.year}-{hoje.month:02d}"
    iso = hoje.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _venc_no_periodo(hoje: date, periodicidade: str, dia: int) -> date:
    """Vencimento dentro do periodo atual (pode ja ter passado)."""
    if periodicidade == "mensal":
        return date(hoje.year, hoje.month, _clamp_dia(hoje.year, hoje.month, dia))
    # semanal: dia = 0=Seg..6=Dom, dentro da semana corrente (Seg-Dom)
    segunda = hoje - timedelta(days=hoje.weekday())
    return segunda + timedelta(days=min(max(dia, 0), 6))


def _prox_venc(hoje: date, periodicidade: str, dia: int) -> date:
    v = _venc_no_periodo(hoje, periodicidade, dia)
    if v >= hoje:
        return v
    if periodicidade == "mensal":
        ny = hoje.year + (1 if hoje.month == 12 else 0)
        nm = 1 if hoje.month == 12 else hoje.month + 1
        return date(ny, nm, _clamp_dia(ny, nm, dia))
    return v + timedelta(days=7)


def _montar_out(db: Session, a: Aluguel) -> AluguelOut:
    hoje = date.today()
    pagos = db.scalars(
        select(PagamentoAluguel).where(PagamentoAluguel.aluguel_id == a.id)
    ).all()
    comp = _competencia(hoje, a.periodicidade)
    pago_ciclo = any(p.competencia == comp for p in pagos)
    venc_periodo = _venc_no_periodo(hoje, a.periodicidade, a.dia_vencimento)

    if not a.ativo:
        status = "inativo"
    elif pago_ciclo:
        status = "em_dia"
    elif hoje > venc_periodo:
        status = "atrasado"
    else:
        status = "pendente"

    prox = _prox_venc(hoje, a.periodicidade, a.dia_vencimento)
    ultimo = max((p.data for p in pagos), default=None)

    nome = None
    if a.motorista_id:
        mot = db.get(User, a.motorista_id)
        nome = mot.nome if mot else None

    desejado = None
    if a.carro_desejado_id:
        cd = db.get(Carro, a.carro_desejado_id)
        desejado = cd.modelo if cd else None

    return AluguelOut(
        id=a.id,
        motorista_email=a.motorista_email,
        motorista_nome=nome,
        vinculado=a.motorista_id is not None,
        carro=a.carro,
        carro_id=a.carro_id,
        valor=a.valor,
        periodicidade=a.periodicidade,
        dia_vencimento=a.dia_vencimento,
        ativo=a.ativo,
        troca_status=a.troca_status,
        carro_desejado=desejado,
        prox_vencimento=prox,
        dias_restantes=(prox - hoje).days,
        status=status,
        ultimo_pagamento=ultimo,
    )


# ---------- locadora ----------
@router.post("", response_model=AluguelOut, status_code=201)
def criar(dados: AluguelCreate, db: Session = Depends(get_db), loc: User = Depends(get_locadora)):
    email = dados.motorista_email.lower()
    mot = db.scalar(select(User).where(User.email == email))

    carro_txt = dados.carro
    carro_id = None
    if dados.carro_id:
        carro = db.get(Carro, dados.carro_id)
        if not carro or carro.locadora_id != loc.id:
            raise HTTPException(status_code=404, detail="Carro nao encontrado")
        if db.scalar(select(Aluguel).where(Aluguel.carro_id == carro.id, Aluguel.ativo.is_(True))):
            raise HTTPException(status_code=409, detail="Esse carro ja esta alugado")
        carro_id = carro.id
        carro_txt = f"{carro.modelo}{f' {carro.placa}' if carro.placa else ''}"

    a = Aluguel(
        locadora_id=loc.id,
        motorista_email=email,
        motorista_id=mot.id if mot else None,
        carro=carro_txt,
        carro_id=carro_id,
        valor=dados.valor,
        periodicidade=dados.periodicidade,
        dia_vencimento=dados.dia_vencimento,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _montar_out(db, a)


@router.get("", response_model=list[AluguelOut])
def listar(db: Session = Depends(get_db), loc: User = Depends(get_locadora)):
    itens = db.scalars(
        select(Aluguel).where(Aluguel.locadora_id == loc.id).order_by(Aluguel.criado_em.desc())
    ).all()
    return [_montar_out(db, a) for a in itens]


@router.get("/resumo", response_model=LocadoraResumo)
def resumo(db: Session = Depends(get_db), loc: User = Depends(get_locadora)):
    itens = db.scalars(
        select(Aluguel).where(Aluguel.locadora_id == loc.id, Aluguel.ativo.is_(True))
    ).all()
    outs = [_montar_out(db, a) for a in itens]
    # receita mensal estimada: semanal conta ~4.33 semanas no mes
    receita = round(sum(a.valor * (4.33 if a.periodicidade == "semanal" else 1.0) for a in itens))
    a_vencer = sum(1 for o in outs if o.status != "atrasado" and o.dias_restantes is not None and o.dias_restantes <= 7)
    atrasados = sum(1 for o in outs if o.status == "atrasado")
    return LocadoraResumo(
        alugueis_ativos=len(itens),
        receita_mensal_prevista=round(receita, 2),
        a_vencer_7dias=a_vencer,
        atrasados=atrasados,
    )


def _obter_da_locadora(db: Session, aluguel_id: str, loc: User) -> Aluguel:
    a = db.get(Aluguel, aluguel_id)
    if not a or a.locadora_id != loc.id:
        raise HTTPException(status_code=404, detail="Aluguel nao encontrado")
    return a


@router.patch("/{aluguel_id}", response_model=AluguelOut)
def atualizar(
    aluguel_id: str,
    dados: AluguelUpdate,
    db: Session = Depends(get_db),
    loc: User = Depends(get_locadora),
):
    a = _obter_da_locadora(db, aluguel_id, loc)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(a, campo, valor)
    db.commit()
    db.refresh(a)
    return _montar_out(db, a)


@router.delete("/{aluguel_id}", status_code=204)
def remover(aluguel_id: str, db: Session = Depends(get_db), loc: User = Depends(get_locadora)):
    a = _obter_da_locadora(db, aluguel_id, loc)
    for p in db.scalars(select(PagamentoAluguel).where(PagamentoAluguel.aluguel_id == a.id)).all():
        db.delete(p)
    db.delete(a)
    db.commit()


@router.post("/{aluguel_id}/pagamento", response_model=PagamentoOut, status_code=201)
def registrar_pagamento(
    aluguel_id: str,
    dados: PagamentoCreate,
    db: Session = Depends(get_db),
    loc: User = Depends(get_locadora),
):
    a = _obter_da_locadora(db, aluguel_id, loc)
    d = dados.data or date.today()
    p = PagamentoAluguel(
        aluguel_id=a.id,
        data=d,
        valor=dados.valor if dados.valor is not None else a.valor,
        competencia=dados.competencia or _competencia(d, a.periodicidade),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/{aluguel_id}/pagamentos", response_model=list[PagamentoOut])
def listar_pagamentos(aluguel_id: str, db: Session = Depends(get_db), loc: User = Depends(get_locadora)):
    _obter_da_locadora(db, aluguel_id, loc)
    return db.scalars(
        select(PagamentoAluguel)
        .where(PagamentoAluguel.aluguel_id == aluguel_id)
        .order_by(PagamentoAluguel.data.desc())
    ).all()


@router.post("/{aluguel_id}/aprovar-troca", response_model=AluguelOut)
def aprovar_troca(aluguel_id: str, db: Session = Depends(get_db), loc: User = Depends(get_locadora)):
    a = _obter_da_locadora(db, aluguel_id, loc)
    if a.troca_status != "solicitada" or not a.carro_desejado_id:
        raise HTTPException(status_code=400, detail="Nao ha troca pendente")
    novo = db.get(Carro, a.carro_desejado_id)
    if not novo:
        raise HTTPException(status_code=404, detail="Carro desejado nao existe mais")
    if db.scalar(select(Aluguel).where(Aluguel.carro_id == novo.id, Aluguel.ativo.is_(True), Aluguel.id != a.id)):
        raise HTTPException(status_code=409, detail="O carro desejado ja foi alugado")
    a.carro_id = novo.id
    a.carro = f"{novo.modelo}{f' {novo.placa}' if novo.placa else ''}"
    a.carro_desejado_id = None
    a.troca_status = None
    db.commit()
    db.refresh(a)
    return _montar_out(db, a)


@router.post("/{aluguel_id}/recusar-troca", response_model=AluguelOut)
def recusar_troca(aluguel_id: str, db: Session = Depends(get_db), loc: User = Depends(get_locadora)):
    a = _obter_da_locadora(db, aluguel_id, loc)
    a.carro_desejado_id = None
    a.troca_status = None
    db.commit()
    db.refresh(a)
    return _montar_out(db, a)


# ---------- motorista ----------
@router.get("/meu", response_model=list[AluguelOut])
def meu_aluguel(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Aluguel(is) ativos vinculados ao motorista logado (por id ou e-mail)."""
    itens = db.scalars(
        select(Aluguel).where(
            Aluguel.ativo.is_(True),
            (Aluguel.motorista_id == user.id) | (Aluguel.motorista_email == user.email),
        )
    ).all()
    return [_montar_out(db, a) for a in itens]


@router.post("/meu/trocar", response_model=AluguelOut)
def solicitar_troca(dados: TrocaSolicitar, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Motorista pede pra trocar pelo carro escolhido (da mesma locadora)."""
    a = db.scalar(
        select(Aluguel).where(
            Aluguel.ativo.is_(True),
            (Aluguel.motorista_id == user.id) | (Aluguel.motorista_email == user.email),
        )
    )
    if not a:
        raise HTTPException(status_code=404, detail="Voce nao tem aluguel ativo")
    carro = db.get(Carro, dados.carro_id)
    if not carro or carro.locadora_id != a.locadora_id or not carro.ativo:
        raise HTTPException(status_code=404, detail="Carro indisponivel")
    if db.scalar(select(Aluguel).where(Aluguel.carro_id == carro.id, Aluguel.ativo.is_(True))):
        raise HTTPException(status_code=409, detail="Esse carro ja esta alugado")
    a.carro_desejado_id = carro.id
    a.troca_status = "solicitada"
    db.commit()
    db.refresh(a)
    return _montar_out(db, a)
