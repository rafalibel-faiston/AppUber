"""Catalogo de carros da locadora. Um carro fica indisponivel enquanto tem
um aluguel ativo vinculado."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_locadora
from ..models import Aluguel, Carro, User
from ..schemas import CarroCreate, CarroOut, CarroUpdate

router = APIRouter(prefix="/api/carros", tags=["carros"])


def _aluguel_ativo_do_carro(db: Session, carro_id: str) -> Aluguel | None:
    return db.scalar(
        select(Aluguel).where(Aluguel.carro_id == carro_id, Aluguel.ativo.is_(True))
    )


def carro_out(db: Session, c: Carro) -> CarroOut:
    alu = _aluguel_ativo_do_carro(db, c.id)
    nome = None
    if alu:
        if alu.motorista_id:
            mot = db.get(User, alu.motorista_id)
            nome = mot.nome if mot else alu.motorista_email
        else:
            nome = alu.motorista_email
    return CarroOut(
        id=c.id,
        modelo=c.modelo,
        placa=c.placa,
        cor=c.cor,
        ano=c.ano,
        km=c.km,
        combustivel=c.combustivel,
        valor_sugerido=c.valor_sugerido,
        observacao=c.observacao,
        ativo=c.ativo,
        disponivel=c.ativo and alu is None,
        motorista_atual=nome,
    )


@router.post("", response_model=CarroOut, status_code=201)
def criar(dados: CarroCreate, db: Session = Depends(get_db), loc: User = Depends(get_locadora)):
    c = Carro(locadora_id=loc.id, **dados.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return carro_out(db, c)


@router.get("", response_model=list[CarroOut])
def listar(db: Session = Depends(get_db), loc: User = Depends(get_locadora)):
    itens = db.scalars(
        select(Carro).where(Carro.locadora_id == loc.id).order_by(Carro.criado_em.desc())
    ).all()
    return [carro_out(db, c) for c in itens]


@router.get("/disponiveis", response_model=list[CarroOut])
def disponiveis(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Carros disponiveis. Locadora: os seus. Motorista: os da locadora do
    aluguel ativo dele (pra poder pedir troca)."""
    if user.papel == "locadora":
        loc_id = user.id
    else:
        alu = db.scalar(
            select(Aluguel).where(
                Aluguel.ativo.is_(True),
                (Aluguel.motorista_id == user.id) | (Aluguel.motorista_email == user.email),
            )
        )
        if not alu:
            return []
        loc_id = alu.locadora_id

    itens = db.scalars(
        select(Carro).where(Carro.locadora_id == loc_id, Carro.ativo.is_(True))
    ).all()
    return [o for c in itens if (o := carro_out(db, c)).disponivel]


def _obter(db: Session, carro_id: str, loc: User) -> Carro:
    c = db.get(Carro, carro_id)
    if not c or c.locadora_id != loc.id:
        raise HTTPException(status_code=404, detail="Carro nao encontrado")
    return c


@router.patch("/{carro_id}", response_model=CarroOut)
def atualizar(
    carro_id: str,
    dados: CarroUpdate,
    db: Session = Depends(get_db),
    loc: User = Depends(get_locadora),
):
    c = _obter(db, carro_id, loc)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(c, campo, valor)
    db.commit()
    db.refresh(c)
    return carro_out(db, c)


@router.delete("/{carro_id}", status_code=204)
def remover(carro_id: str, db: Session = Depends(get_db), loc: User = Depends(get_locadora)):
    c = _obter(db, carro_id, loc)
    if _aluguel_ativo_do_carro(db, c.id):
        raise HTTPException(status_code=409, detail="Carro tem aluguel ativo; encerre o aluguel antes")
    db.delete(c)
    db.commit()
