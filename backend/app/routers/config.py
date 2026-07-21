"""Configuracao de custos e calculadora 'Vale a pena?'."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Config, User
from ..schemas import ConfigOut, ConfigUpdate, ValeAPenaIn, ValeAPenaOut

router = APIRouter(prefix="/api/config", tags=["config"])


def _get_or_create(db: Session, user_id: str) -> Config:
    cfg = db.scalar(select(Config).where(Config.usuario_id == user_id))
    if not cfg:
        cfg = Config(usuario_id=user_id)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _custo_por_km(cfg: Config) -> float:
    combustivel_km = cfg.preco_combustivel / cfg.consumo_km_l if cfg.consumo_km_l > 0 else 0
    return round(combustivel_km + cfg.manutencao_por_km, 3)


def _to_out(cfg: Config) -> ConfigOut:
    out = ConfigOut.model_validate(cfg)
    out.custo_por_km = _custo_por_km(cfg)
    return out


@router.get("", response_model=ConfigOut)
def obter(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _to_out(_get_or_create(db, user.id))


@router.put("", response_model=ConfigOut)
def atualizar(dados: ConfigUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cfg = _get_or_create(db, user.id)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(cfg, campo, valor)
    db.commit()
    db.refresh(cfg)
    return _to_out(cfg)


@router.post("/vale-a-pena", response_model=ValeAPenaOut)
def vale_a_pena(dados: ValeAPenaIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cfg = _get_or_create(db, user.id)
    custo_km = _custo_por_km(cfg)
    custo = round(dados.km * custo_km, 2)
    lucro = round(dados.valor - custo, 2)
    r_por_km = round(dados.valor / dados.km, 2) if dados.km > 0 else 0

    # Veredito: prejuizo se nao cobre o custo; otimo se lucro por km >= alvo (ou >= 2x custo).
    alvo = cfg.meta_lucro_por_km if cfg.meta_lucro_por_km > 0 else custo_km
    lucro_por_km = r_por_km - custo_km
    if lucro <= 0:
        veredito = "prejuizo"
    elif lucro_por_km >= alvo:
        veredito = "otimo"
    else:
        veredito = "ok"

    r_por_hora = None
    if dados.minutos and dados.minutos > 0:
        r_por_hora = round(lucro / (dados.minutos / 60), 2)

    return ValeAPenaOut(
        valor=dados.valor,
        km=dados.km,
        custo_estimado=custo,
        lucro_estimado=lucro,
        valor_por_km=r_por_km,
        custo_por_km=custo_km,
        veredito=veredito,
        r_por_hora=r_por_hora,
    )
