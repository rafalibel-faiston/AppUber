"""Ponto de entrada da API Volante."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import Base, engine, ensure_columns
from .routers import (
    agenda,
    alugueis,
    auth,
    carros,
    config,
    contas,
    corridas,
    dashboard,
    gastos,
    jornadas,
    metas,
    turnos,
)

# MVP: cria as tabelas no start e adiciona colunas novas em tabelas existentes.
Base.metadata.create_all(bind=engine)
ensure_columns()

app = FastAPI(title="Volante API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(config.router)
app.include_router(contas.router)
app.include_router(corridas.router)
app.include_router(turnos.router)
app.include_router(jornadas.router)
app.include_router(gastos.router)
app.include_router(metas.router)
app.include_router(agenda.router)
app.include_router(alugueis.router)
app.include_router(carros.router)
app.include_router(dashboard.router)


@app.get("/api/health", tags=["infra"])
def health():
    return {"status": "ok", "app": "volante"}


# ---- Servir o front (PWA) buildado em producao ----
# O build do Vite vai para frontend/dist. Em prod copiamos/servimos daqui.
_dist = Path(__file__).resolve().parent.parent / "static"
if _dist.exists():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        # Deixa a API responder /api/*; o resto cai no index.html (SPA).
        arquivo = _dist / full_path
        if full_path and arquivo.is_file():
            return FileResponse(arquivo)
        return FileResponse(_dist / "index.html")
