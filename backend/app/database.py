"""Conexao com o banco e sessao do SQLAlchemy."""
from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

_url = settings.normalized_database_url
# check_same_thread so faz sentido no SQLite (dev local)
_connect_args = {"check_same_thread": False} if _url.startswith("sqlite") else {}

engine = create_engine(_url, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_columns() -> None:
    """Migração leve: adiciona ao banco colunas novas dos modelos que ainda
    não existem nas tabelas já criadas (o create_all não altera tabelas)."""
    insp = inspect(engine)
    for table_name, table in Base.metadata.tables.items():
        if not insp.has_table(table_name):
            continue
        existentes = {c["name"] for c in insp.get_columns(table_name)}
        for col in table.columns:
            if col.name in existentes:
                continue
            tipo = col.type.compile(dialect=engine.dialect)
            ddl = f'ALTER TABLE {table_name} ADD COLUMN "{col.name}" {tipo}'
            default = col.default
            if default is not None and getattr(default, "is_scalar", False):
                val = default.arg
                val = f"'{val}'" if isinstance(val, str) else val
                ddl += f" DEFAULT {val}"
            with engine.begin() as conn:
                conn.execute(text(ddl))
