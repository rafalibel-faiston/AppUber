"""Funcoes auxiliares de calculo."""
from datetime import date, time, timedelta


def horas_trabalhadas(inicio: time | None, fim: time | None) -> float:
    """Horas entre inicio e fim. Trata virada de meia-noite."""
    if not inicio or not fim:
        return 0.0
    ini = inicio.hour + inicio.minute / 60
    end = fim.hour + fim.minute / 60
    diff = end - ini
    if diff < 0:  # passou da meia-noite
        diff += 24
    return round(diff, 2)


def intervalo_periodo(periodo: str, referencia: date | None = None) -> tuple[date, date]:
    """Retorna (inicio, fim) inclusivos para 'diaria', 'semanal' ou 'mensal'."""
    ref = referencia or date.today()
    if periodo == "diaria":
        return ref, ref
    if periodo == "semanal":
        inicio = ref - timedelta(days=ref.weekday())  # segunda
        return inicio, inicio + timedelta(days=6)
    if periodo == "mensal":
        inicio = ref.replace(day=1)
        proximo = (inicio.replace(day=28) + timedelta(days=4)).replace(day=1)
        return inicio, proximo - timedelta(days=1)
    # fallback: mes atual
    inicio = ref.replace(day=1)
    proximo = (inicio.replace(day=28) + timedelta(days=4)).replace(day=1)
    return inicio, proximo - timedelta(days=1)
