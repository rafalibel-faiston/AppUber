import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Page from "../components/Page";
import Sheet from "../components/Sheet";
import { api } from "../lib/api";
import { dataLonga, hojeISO, mesAno, ymd } from "../lib/format";
import type { AgendaDia } from "../lib/types";

const DIAS_SEM = ["D", "S", "T", "Q", "Q", "S", "S"];
const PRESETS = [4, 6, 8, 10, 12];

type Mapa = Record<string, AgendaDia>;

export default function Agenda() {
  const navigate = useNavigate();
  const hoje = hojeISO();
  const agora = new Date();

  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth()); // 0-11
  const [mapa, setMapa] = useState<Mapa>({});
  const [carregando, setCarregando] = useState(true);

  // Sheet de edicao de um dia
  const [aberto, setAberto] = useState(false);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [modo, setModo] = useState<"trabalhar" | "folga">("trabalhar");
  const [horas, setHoras] = useState(8);
  const [salvando, setSalvando] = useState(false);

  const primeiroISO = ymd(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const ultimoISO = ymd(ano, mes, ultimoDia);

  function carregar() {
    setCarregando(true);
    api
      .get<AgendaDia[]>(`/agenda?inicio=${primeiroISO}&fim=${ultimoISO}`)
      .then((lista) => {
        const m: Mapa = {};
        for (const d of lista) m[d.data] = d;
        setMapa(m);
      })
      .catch(() => setMapa({}))
      .finally(() => setCarregando(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(carregar, [ano, mes]);

  // Celulas do mes (6 semanas = 42 celulas, comecando no domingo).
  const celulas = useMemo(() => {
    const inicioSemana = new Date(ano, mes, 1).getDay(); // 0=Dom
    const arr: (number | null)[] = [];
    for (let i = 0; i < inicioSemana; i++) arr.push(null);
    for (let d = 1; d <= ultimoDia; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [ano, mes, ultimoDia]);

  // Resumo do mes (a partir do que ja temos em memoria).
  const resumo = useMemo(() => {
    const dias = Object.values(mapa).filter((d) => d.data >= primeiroISO && d.data <= ultimoISO);
    const trabalho = dias.filter((d) => d.trabalhar);
    const folgas = dias.filter((d) => !d.trabalhar);
    const totalHoras = trabalho.reduce((s, d) => s + d.horas_alvo, 0);
    return {
      diasTrab: trabalho.length,
      folgas: folgas.length,
      horas: Math.round(totalHoras * 10) / 10,
      media: trabalho.length ? Math.round((totalHoras / trabalho.length) * 10) / 10 : 0,
    };
  }, [mapa, primeiroISO, ultimoISO]);

  function mudarMes(delta: number) {
    let m = mes + delta;
    let a = ano;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMes(m);
    setAno(a);
  }

  function abrirDia(dia: number) {
    const iso = ymd(ano, mes, dia);
    const atual = mapa[iso];
    setDiaSel(iso);
    setModo(atual && !atual.trabalhar ? "folga" : "trabalhar");
    setHoras(atual?.horas_alvo && atual.horas_alvo > 0 ? atual.horas_alvo : 8);
    setAberto(true);
  }

  async function salvar() {
    if (!diaSel || salvando) return;
    setSalvando(true);
    try {
      const dado = await api.put<AgendaDia>("/agenda", {
        data: diaSel,
        trabalhar: modo === "trabalhar",
        horas_alvo: modo === "trabalhar" ? horas : 0,
      });
      setMapa((m) => ({ ...m, [diaSel]: dado }));
      setAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  async function limpar() {
    if (!diaSel || salvando) return;
    setSalvando(true);
    try {
      await api.del(`/agenda/${diaSel}`);
      setMapa((m) => {
        const c = { ...m };
        delete c[diaSel];
        return c;
      });
      setAberto(false);
    } catch {
      setAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Page>
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="icon-btn" onClick={() => navigate("/")} aria-label="Voltar">
            ‹
          </button>
          <div>
            <div className="hello">Planejamento</div>
            <div className="name" style={{ fontSize: 22 }}>
              Agenda
            </div>
          </div>
        </div>
      </div>

      {/* Resumo do mes */}
      <div className="hero" style={{ marginBottom: 18 }}>
        <div className="label">Planejado para {mesAno(ano, mes).toLowerCase()}</div>
        <div className="big pos" style={{ fontSize: 34 }}>
          {resumo.horas}h
        </div>
        <div className="sub">
          {resumo.diasTrab} {resumo.diasTrab === 1 ? "dia de trabalho" : "dias de trabalho"}
          {resumo.folgas > 0 && <> &nbsp;·&nbsp; {resumo.folgas} de folga</>}
          {resumo.media > 0 && <> &nbsp;·&nbsp; média {resumo.media}h/dia</>}
        </div>
      </div>

      {/* Navegacao de mes */}
      <div className="cal-nav">
        <button onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
        <span className="cal-mes">{mesAno(ano, mes)}</span>
        <button onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
      </div>

      {/* Calendario */}
      <div className={`cal-card ${carregando ? "loading-op" : ""}`}>
        <div className="cal-head">
          {DIAS_SEM.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="cal-grid">
          {celulas.map((dia, i) => {
            if (dia === null) return <div key={i} className="cal-cell empty" />;
            const iso = ymd(ano, mes, dia);
            const plano = mapa[iso];
            const isHoje = iso === hoje;
            const cls = [
              "cal-cell",
              isHoje ? "hoje" : "",
              plano?.trabalhar ? "trab" : "",
              plano && !plano.trabalhar ? "folga" : "",
            ].join(" ");
            return (
              <motion.button
                key={i}
                className={cls}
                whileTap={{ scale: 0.88 }}
                onClick={() => abrirDia(dia)}
              >
                <span className="d">{dia}</span>
                {plano?.trabalhar && plano.horas_alvo > 0 && (
                  <span className="h">{plano.horas_alvo}h</span>
                )}
                {plano && !plano.trabalhar && <span className="h folga-ic">😴</span>}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="cal-legenda">
        <span><i className="dot trab" /> Trabalho</span>
        <span><i className="dot folga" /> Folga</span>
        <span><i className="dot hoje" /> Hoje</span>
      </div>

      {/* Sheet: editar um dia */}
      <Sheet open={aberto} title={diaSel ? dataLonga(diaSel) : ""} onClose={() => setAberto(false)}>
        <div className="modo-row">
          <button
            className={`modo ${modo === "trabalhar" ? "active" : ""}`}
            onClick={() => setModo("trabalhar")}
          >
            🚗 Trabalhar
          </button>
          <button
            className={`modo ${modo === "folga" ? "active folga" : ""}`}
            onClick={() => setModo("folga")}
          >
            😴 Folga
          </button>
        </div>

        {modo === "trabalhar" && (
          <>
            <div className="horas-label">Quantas horas quer rodar?</div>
            <div className="stepper">
              <button onClick={() => setHoras((h) => Math.max(1, Math.round((h - 0.5) * 10) / 10))}>−</button>
              <div className="valor">
                <b>{horas}</b>
                <small>horas</small>
              </div>
              <button onClick={() => setHoras((h) => Math.min(24, Math.round((h + 0.5) * 10) / 10))}>+</button>
            </div>
            <div className="chips" style={{ marginTop: 14, justifyContent: "center" }}>
              {PRESETS.map((p) => (
                <div
                  key={p}
                  className={`chip ${horas === p ? "active" : ""}`}
                  onClick={() => setHoras(p)}
                >
                  {p}h
                </div>
              ))}
            </div>
          </>
        )}

        <button className="btn primary" disabled={salvando} style={{ marginTop: 22 }} onClick={salvar}>
          {salvando ? "Salvando..." : "Salvar dia"}
        </button>
        {diaSel && mapa[diaSel] && (
          <button className="btn ghost block" style={{ marginTop: 10 }} onClick={limpar}>
            Limpar plano do dia
          </button>
        )}
      </Sheet>
    </Page>
  );
}
