"""Configuracao central da aplicacao (le variaveis de ambiente)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Banco: Railway injeta DATABASE_URL. Localmente cai no SQLite.
    database_url: str = "sqlite:///./volante.db"

    # Auth
    jwt_secret: str = "troque-esta-chave-em-producao"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 30  # 30 dias

    # CORS: em dev o front roda no Vite (5173). Em prod servimos junto.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def normalized_database_url(self) -> str:
        url = self.database_url
        # Railway/Heroku as vezes usam o esquema antigo "postgres://"
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
