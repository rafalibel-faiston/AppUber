"""Dependencias reutilizaveis (usuario autenticado)."""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decodificar_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais invalidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    sub = decodificar_token(token)
    if sub is None:
        raise cred_exc
    user = db.get(User, sub)
    if user is None:
        raise cred_exc
    return user


def get_locadora(user: User = Depends(get_current_user)) -> User:
    """Garante que o usuario autenticado e uma locadora."""
    if user.papel != "locadora":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas contas de locadora podem acessar isto",
        )
    return user
