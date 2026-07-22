"""Cadastro e login."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import Token, UserCreate, UserLogin, UserOut
from ..security import criar_token, hash_senha, verificar_senha

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _autenticar(db: Session, email: str, senha: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if not user or not verificar_senha(senha, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
        )
    return user


@router.post("/register", response_model=Token, status_code=201)
def register(dados: UserCreate, db: Session = Depends(get_db)):
    existe = db.scalar(select(User).where(User.email == dados.email.lower()))
    if existe:
        raise HTTPException(status_code=409, detail="E-mail ja cadastrado")
    user = User(
        nome=dados.nome,
        email=dados.email.lower(),
        senha_hash=hash_senha(dados.senha),
        papel=dados.papel,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Se ja existem alugueis criados para este e-mail (antes da conta existir),
    # vincula-os agora ao motorista recem-cadastrado.
    if user.papel == "motorista":
        from ..models import Aluguel  # import local para evitar ciclo
        pendentes = db.scalars(
            select(Aluguel).where(Aluguel.motorista_email == user.email, Aluguel.motorista_id.is_(None))
        ).all()
        for a in pendentes:
            a.motorista_id = user.id
        if pendentes:
            db.commit()

    return Token(access_token=criar_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(dados: UserLogin, db: Session = Depends(get_db)):
    user = _autenticar(db, dados.email, dados.senha)
    return Token(access_token=criar_token(user.id), user=UserOut.model_validate(user))


@router.post("/token", response_model=Token, include_in_schema=False)
def login_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Compatibilidade com o fluxo OAuth2 padrao (username = email)."""
    user = _autenticar(db, form.username, form.password)
    return Token(access_token=criar_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
