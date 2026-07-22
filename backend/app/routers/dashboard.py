"""Resumo financeiro consolidado para o dashboard."""
from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Agenda, Config, Corrida, Gasto, Meta, Turno, User
from ..schemas import DashboardResumo, Insight, PlataformaComparacao, SerieDia
from ..utils import intervalo_periodo

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _brl(v: float) -> str:
    """Formata em reais no padrao brasileiro (R$ 1.234,56)."""
    s = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def _dias_trabalho(db: Session, user_id: str, inicio: date, fim: date) -> int:
    """Dias marcados como trabalho na Agenda dentro do intervalo."""
    return db.scalar(
        select(func.count()).select_from(Agenda).where(
            Agenda.usuario_id == user_id,
            Agenda.trabalhar.is_(True),
            Agenda.data >= inicio,
            Agenda.data <= fim,
        )
    ) or 0


def _meta_efetiva(
    db: Session, user_id: str, periodo: str, inicio: date, fim: date, ref: date
) -> float | None:
    """Meta do periodo. Se existir meta MENSAL, distribui em semanal/diaria
    pelos dias que o motorista marcou na Agenda (cai em dias corridos se a
    Agenda estiver vazia). Sem meta mensal, usa a meta explicita do periodo."""
    mensal = db.scalar(
        select(Meta)
        .where(Meta.usuario_id == user_id, Meta.periodo == "mensal", Meta.ativo.is_(True))
        .order_by(Meta.criado_em.desc())
    )
    if mensal and mensal.valor_alvo > 0:
        m = mensal.valor_alvo
        if periodo == "mensal":
            return round(m, 2)

        mes_ini, mes_fim = intervalo_periodo("mensal", ref)
        dias_mes = _dias_trabalho(db, user_id, mes_ini, mes_fim)
        if dias_mes > 0:
            por_dia = m / dias_mes
            if periodo == "diaria":
                return round(por_dia, 2)
            dias_semana = _dias_trabalho(db, user_id, inicio, fim)  # semana pedida
            return round(por_dia * dias_semana, 2) if dias_semana > 0 else None
        # Agenda vazia: distribui igual pelos dias corridos do mes
        corridos = (mes_fim - mes_ini).days + 1
        por_dia = m / corridos
        if periodo == "diaria":
            return round(por_dia, 2)
        return round(por_dia * 7, 2)

    explicita = db.scalar(
        select(Meta)
        .where(Meta.usuario_id == user_id, Meta.periodo == periodo, Meta.ativo.is_(True))
        .order_by(Meta.criado_em.desc())
    )
    return round(explicita.valor_alvo, 2) if explicita else None


@router.get("/resumo", response_model=DashboardResumo)
def resumo(
    periodo: str = Query("semanal", pattern="^(diaria|semanal|mensal)$"),
    hoje: date | None = Query(None),  # data local do cliente (evita erro de fuso)
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ref = hoje or date.today()
    inicio, fim = intervalo_periodo(periodo, ref)

    corridas = db.scalars(
        select(Corrida).where(
            Corrida.usuario_id == user.id,
            Corrida.data >= inicio,
            Corrida.data <= fim,
        )
    ).all()

    ganho_bruto = sum(c.valor for c in corridas)
    km_manual = sum(c.km for c in corridas)
    num_corridas = len(corridas)

    # Horas trabalhadas: soma real dos turnos cronometrados no periodo.
    turnos = db.scalars(
        select(Turno).where(
            Turno.usuario_id == user.id,
            Turno.data >= inicio,
            Turno.data <= fim,
        )
    ).all()
    agora = datetime.utcnow()
    horas = 0.0
    km_gps = 0.0
    for t in turnos:
        fim_t = t.fim or agora  # turno aberto conta ate agora
        horas += max((fim_t - t.inicio).total_seconds(), 0) / 3600
        km_gps += t.km or 0.0

    # Prefere a distancia real do GPS; cai no km manual das corridas se nao houver.
    km = km_gps if km_gps > 0 else km_manual

    # Dias trabalhados = dias distintos com corridas OU turnos.
    dias = len({c.data for c in corridas} | {t.data for t in turnos})

    # So calcula lucro/hora com pelo menos ~6 min de turno (evita numero absurdo).
    horas_validas = horas if horas >= 0.1 else 0.0

    total_gastos = db.scalar(
        select(func.coalesce(func.sum(Gasto.valor), 0.0)).where(
            Gasto.usuario_id == user.id,
            Gasto.data >= inicio,
            Gasto.data <= fim,
        )
    ) or 0.0

    lucro = ganho_bruto - total_gastos

    meta_valor = _meta_efetiva(db, user.id, periodo, inicio, fim, ref)
    meta_progresso = None
    if meta_valor and meta_valor > 0:
        meta_progresso = round(max(lucro, 0) / meta_valor, 4)

    return DashboardResumo(
        periodo=periodo,
        inicio=inicio,
        fim=fim,
        ganho_bruto=round(ganho_bruto, 2),
        total_gastos=round(float(total_gastos), 2),
        lucro_liquido=round(lucro, 2),
        horas_trabalhadas=round(horas, 2),
        km_rodado=round(km, 2),
        num_corridas=num_corridas,
        dias_trabalhados=dias,
        lucro_por_hora=round(lucro / horas_validas, 2) if horas_validas > 0 else 0.0,
        lucro_por_km=round(lucro / km, 2) if km > 0 else 0.0,
        ganho_por_corrida=round(ganho_bruto / num_corridas, 2) if num_corridas > 0 else 0.0,
        meta_valor=meta_valor,
        meta_progresso=meta_progresso,
    )


@router.get("/plataformas", response_model=list[PlataformaComparacao])
def comparar_plataformas(
    periodo: str = Query("mensal", pattern="^(diaria|semanal|mensal)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    inicio, fim = intervalo_periodo(periodo)
    corridas = db.scalars(
        select(Corrida).where(
            Corrida.usuario_id == user.id,
            Corrida.data >= inicio,
            Corrida.data <= fim,
        )
    ).all()

    agrup: dict = defaultdict(lambda: {"total": 0.0, "num": 0, "km": 0.0})
    for c in corridas:
        g = agrup[c.plataforma]
        g["total"] += c.valor
        g["num"] += 1
        g["km"] += c.km

    total_geral = sum(g["total"] for g in agrup.values()) or 1.0

    resultado = [
        PlataformaComparacao(
            plataforma=plat,
            total=round(g["total"], 2),
            num_corridas=g["num"],
            km=round(g["km"], 2),
            r_por_corrida=round(g["total"] / g["num"], 2) if g["num"] else 0.0,
            r_por_km=round(g["total"] / g["km"], 2) if g["km"] else 0.0,
            percentual=round(g["total"] / total_geral, 4),
        )
        for plat, g in agrup.items()
    ]
    resultado.sort(key=lambda x: x.total, reverse=True)
    return resultado


def _lucro_por_dia(db: Session, user_id: str, inicio: date, fim: date) -> dict[date, dict]:
    """Agrega ganho/gastos/corridas por dia no intervalo (dias sem dado ficam zerados)."""
    dias = (fim - inicio).days + 1
    por_dia = {
        inicio + timedelta(days=i): {"ganho": 0.0, "gastos": 0.0, "corridas": 0}
        for i in range(dias)
    }
    corridas = db.scalars(
        select(Corrida).where(
            Corrida.usuario_id == user_id, Corrida.data >= inicio, Corrida.data <= fim
        )
    ).all()
    for c in corridas:
        d = por_dia.get(c.data)
        if d:
            d["ganho"] += c.valor
            d["corridas"] += 1
    gastos = db.scalars(
        select(Gasto).where(
            Gasto.usuario_id == user_id, Gasto.data >= inicio, Gasto.data <= fim
        )
    ).all()
    for g in gastos:
        d = por_dia.get(g.data)
        if d:
            d["gastos"] += g.valor
    return por_dia


@router.get("/serie", response_model=list[SerieDia])
def serie(
    dias: int = Query(14, ge=1, le=90),
    hoje: date | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Serie diaria de lucro (ganho - gastos) para o grafico dos ultimos N dias."""
    fim = hoje or date.today()
    inicio = fim - timedelta(days=dias - 1)
    por_dia = _lucro_por_dia(db, user.id, inicio, fim)
    return [
        SerieDia(
            data=dt,
            ganho=round(v["ganho"], 2),
            gastos=round(v["gastos"], 2),
            lucro=round(v["ganho"] - v["gastos"], 2),
            corridas=v["corridas"],
        )
        for dt, v in sorted(por_dia.items())
    ]


@router.get("/insights", response_model=list[Insight])
def insights(
    hoje: date | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Avisos automaticos (critico/atencao/bom) a partir dos numeros do motorista."""
    ref = hoje or date.today()
    cfg = db.scalar(select(Config).where(Config.usuario_id == user.id))
    custo_km = 0.0
    alvo_km = 0.0
    if cfg and cfg.consumo_km_l > 0:
        custo_km = round(cfg.preco_combustivel / cfg.consumo_km_l + cfg.manutencao_por_km, 3)
        alvo_km = cfg.meta_lucro_por_km if cfg.meta_lucro_por_km > 0 else custo_km

    # --- Semana atual ---
    ini_s, fim_s = intervalo_periodo("semanal", ref)
    corr_s = db.scalars(
        select(Corrida).where(
            Corrida.usuario_id == user.id, Corrida.data >= ini_s, Corrida.data <= fim_s
        )
    ).all()
    ganho_s = sum(c.valor for c in corr_s)
    km_manual_s = sum(c.km for c in corr_s)
    turnos_s = db.scalars(
        select(Turno).where(
            Turno.usuario_id == user.id, Turno.data >= ini_s, Turno.data <= fim_s
        )
    ).all()
    agora = datetime.utcnow()
    km_gps_s = sum(t.km or 0.0 for t in turnos_s)
    km_s = km_gps_s if km_gps_s > 0 else km_manual_s
    gastos_s = db.scalar(
        select(func.coalesce(func.sum(Gasto.valor), 0.0)).where(
            Gasto.usuario_id == user.id, Gasto.data >= ini_s, Gasto.data <= fim_s
        )
    ) or 0.0
    lucro_s = ganho_s - float(gastos_s)

    meta = db.scalar(
        select(Meta)
        .where(Meta.usuario_id == user.id, Meta.periodo == "semanal", Meta.ativo.is_(True))
        .order_by(Meta.criado_em.desc())
    )

    # --- Melhor dia (30 dias) ---
    hoje = ref
    por_dia_30 = _lucro_por_dia(db, user.id, hoje - timedelta(days=29), hoje)
    melhor_dia, melhor_lucro = None, 0.0
    for dt, v in por_dia_30.items():
        lucro = v["ganho"] - v["gastos"]
        if lucro > melhor_lucro:
            melhor_dia, melhor_lucro = dt, lucro

    ins: list[Insight] = []

    # Critico: bruto por km abaixo do custo por km
    if km_s > 0 and custo_km > 0:
        bruto_km = ganho_s / km_s
        if bruto_km < custo_km:
            ins.append(Insight(
                nivel="critico", icone="🔴", titulo="Rodando no vermelho",
                texto=f"Esta semana você recebe {_brl(bruto_km)}/km, mas seu custo é "
                      f"{_brl(custo_km)}/km. Cada km está dando prejuízo.",
            ))

    # Meta da semana
    if meta and meta.valor_alvo > 0:
        if lucro_s >= meta.valor_alvo:
            ins.append(Insight(
                nivel="bom", icone="🎉", titulo="Meta da semana batida!",
                texto=f"Você já fez {_brl(lucro_s)} de lucro — acima da meta de "
                      f"{_brl(meta.valor_alvo)}.",
            ))
        else:
            falta = meta.valor_alvo - max(lucro_s, 0)
            pct = round(max(lucro_s, 0) / meta.valor_alvo * 100)
            ins.append(Insight(
                nivel="atencao", icone="🟡", titulo="Quase lá na meta",
                texto=f"Faltam {_brl(falta)} pra bater a meta da semana ({pct}%).",
            ))

    # Bom: lucro por km saudavel
    if km_s > 0 and alvo_km > 0:
        lpk = lucro_s / km_s
        if lpk >= alvo_km:
            ins.append(Insight(
                nivel="bom", icone="🟢", titulo="Seu km está valendo a pena",
                texto=f"Lucro de {_brl(lpk)}/km nesta semana — acima do seu alvo.",
            ))

    # Bom: melhor dia
    if melhor_dia and melhor_lucro > 0:
        dstr = melhor_dia.strftime("%d/%m")
        ins.append(Insight(
            nivel="bom", icone="⭐", titulo="Seu melhor dia (30 dias)",
            texto=f"{dstr} rendeu {_brl(melhor_lucro)} de lucro líquido.",
        ))

    # Atencao: custo do carro nao configurado
    if not cfg or custo_km == 0:
        ins.append(Insight(
            nivel="atencao", icone="⚙️", titulo="Configure o custo do carro",
            texto="Sem o custo por km, o lucro real fica incompleto. Faça isso em Ajustes.",
        ))

    if not ins:
        ins.append(Insight(
            nivel="info", icone="📊", titulo="Sem dados suficientes ainda",
            texto="Registre corridas e gastos pra receber avisos automáticos aqui.",
        ))

    ordem = {"critico": 0, "atencao": 1, "bom": 2, "info": 3}
    ins.sort(key=lambda x: ordem.get(x.nivel, 9))
    return ins[:4]
