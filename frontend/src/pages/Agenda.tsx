import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Page from "../components/Page";
import Sheet from "../components/Sheet";
import { api } from "../lib/api";
import { dataLonga, hojeISO, mesAno, ymd } from "../lib/format";
import type { AgendaDia } from "../lib/types";

const DIAS_SEM = ["D", "S", "T", "Q", "Q", "S", "S"];
const PRESETS = [4, 6, 8, 10, 12];
type Brush = "trabalho" | "folga" | "limpar";
type Escopo = "todos" | "uteis" | "fds";
type Mapa = Record<string, AgendaDia>;

export default function Agenda() {
  const navigate = useNavigate();
  const hoje = hojeISO();
  const agora = new Date();

  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth()); // 0-11
  const [mapa, setMapa] = useState<Mapa>({});
  const [carregando, setCarregando] = useState(true);

  // Pincel + horas padrao
  const [brush, setBrush] = useState<Brush>("trabalho");
  const [horasPadrao, setHorasPadrao] = useState(8);

  // Arrastar para pintar
  const gridRef = useRef<HTMLDivElement>(null);
  const pintandoRef = useRef(false);
  const arrastouRef = useRef(false);
  const inicioRef = useRef<string | null>(null);
  const selRef = useRef<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());

  // Sheet de edicao de um dia
  const [aberto, setAberto] = useState(false);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [modo, setModo] = useState<"trabalhar" | "folga">("trabalhar");
  const [horas, setHoras] = useState(8);
  const [salvando, setSalvando] = useState(false);

  // Sheet de preencher o mes
  const [preAberto, setPreAberto] = useState(false);
  const [escopo, setEscopo] = useState<Escopo>("todos");

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

  // Celulas do mes (6 semanas, comecando no domingo).
  const celulas = useMemo(() => {
    const inicioSemana = new Date(ano, mes, 1).getDay(); // 0=Dom
    const arr: (number | null)[] = [];
    for (let i = 0; i < inicioSemana; i++) arr.push(null);
    for (let d = 1; d <= ultimoDia; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [ano, mes, ultimoDia]);

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

  // ---------- aplicar em lote ----------
  async function aplicar(dias: string[], b: Brush) {
    if (!dias.length) return;
    if (b === "limpar") {
      // otimista
      setMapa((m) => { const c = { ...m }; dias.forEach((d) => delete c[d]); return c; });
      await api.post("/agenda/bulk", { datas: dias, limpar: true }).catch(() => carregar());
      return;
    }
    const trabalhar = b === "trabalho";
    const res = await api
      .post<AgendaDia[]>("/agenda/bulk", { datas: dias, trabalhar, horas_alvo: trabalhar ? horasPadrao : 0 })
      .catch(() => null);
    if (res) setMapa((m) => { const c = { ...m }; res.forEach((d) => { c[d.data] = d; }); return c; });
    else carregar();
  }

  // ---------- arrastar (pointer) ----------
  function diaEmPonto(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const cell = el?.closest("[data-dia]") as HTMLElement | null;
    return cell?.dataset.dia ?? null;
  }

  function onDown(e: React.PointerEvent) {
    const cell = (e.target as HTMLElement).closest("[data-dia]") as HTMLElement | null;
    const dia = cell?.dataset.dia;
    if (!dia) return;
    pintandoRef.current = true;
    arrastouRef.current = false;
    inicioRef.current = dia;
    const s = new Set<string>([dia]);
    selRef.current = s;
    setSel(new Set(s));
    try { gridRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
  }

  function onMove(e: React.PointerEvent) {
    if (!pintandoRef.current) return;
    const dia = diaEmPonto(e.clientX, e.clientY);
    if (!dia) return;
    if (dia !== inicioRef.current) arrastouRef.current = true;
    if (!selRef.current.has(dia)) {
      const s = new Set(selRef.current);
      s.add(dia);
      selRef.current = s;
      setSel(s);
    }
  }

  function onUp(e: React.PointerEvent) {
    if (!pintandoRef.current) return;
    pintandoRef.current = false;
    try { gridRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const dias = Array.from(selRef.current);
    const arrastou = arrastouRef.current;
    selRef.current = new Set();
    setSel(new Set());
    if (!arrastou && dias.length === 1) {
      abrirDia(dias[0]); // toque simples = editar manualmente
      return;
    }
    aplicar(dias, brush);
  }

  // ---------- editar um dia ----------
  function abrirDia(iso: string) {
    const atual = mapa[iso];
    setDiaSel(iso);
    setModo(atual && !atual.trabalhar ? "folga" : "trabalhar");
    setHoras(atual?.horas_alvo && atual.horas_alvo > 0 ? atual.horas_alvo : horasPadrao);
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

  async function limparDia() {
    if (!diaSel || salvando) return;
    setSalvando(true);
    try {
      await api.del(`/agenda/${diaSel}`);
      setMapa((m) => { const c = { ...m }; delete c[diaSel]; return c; });
      setAberto(false);
    } catch {
      setAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  // ---------- preencher o mes ----------
  function datasEscopo(f: Escopo): string[] {
    const arr: string[] = [];
    for (let d = 1; d <= ultimoDia; d++) {
      const wd = new Date(ano, mes, d).getDay();
      const fds = wd === 0 || wd === 6;
      if (f === "uteis" && fds) continue;
      if (f === "fds" && !fds) continue;
      arr.push(ymd(ano, mes, d));
    }
    return arr;
  }

  async function preencher(b: Brush) {
    await aplicar(datasEscopo(escopo), b);
    setPreAberto(false);
  }

  const brushLabel: Record<Brush, string> = {
    trabalho: "Trabalho",
    folga: "Folga",
    limpar: "Limpar",
  };

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

      {/* Pincel */}
      <div className="brush-bar">
        {(["trabalho", "folga", "limpar"] as Brush[]).map((b) => (
          <button
            key={b}
            className={`brush ${brush === b ? "active" : ""} ${b}`}
            onClick={() => setBrush(b)}
          >
            {b === "trabalho" ? "🚗" : b === "folga" ? "😴" : "🧽"} {brushLabel[b]}
          </button>
        ))}
      </div>

      {/* Horas padrao (so faz sentido pintando trabalho) */}
      {brush === "trabalho" && (
        <div className="padrao-row">
          <span className="lbl">Horas padrão</span>
          <div className="mini-step">
            <button onClick={() => setHorasPadrao((h) => Math.max(1, Math.round((h - 1) * 10) / 10))}>−</button>
            <b>{horasPadrao}h</b>
            <button onClick={() => setHorasPadrao((h) => Math.min(24, Math.round((h + 1) * 10) / 10))}>+</button>
          </div>
        </div>
      )}

      <div className="brush-hint">
        Arraste o dedo pelos dias para marcar em série · toque num dia para ajustar
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
        <div
          className="cal-grid"
          ref={gridRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
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
              sel.has(iso) ? "sel" : "",
            ].join(" ");
            return (
              <div key={i} data-dia={iso} className={cls}>
                <span className="d">{dia}</span>
                {plano?.trabalhar && plano.horas_alvo > 0 && (
                  <span className="h">{plano.horas_alvo}h</span>
                )}
                {plano && !plano.trabalhar && <span className="h folga-ic">😴</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="cal-legenda">
        <span><i className="dot trab" /> Trabalho</span>
        <span><i className="dot folga" /> Folga</span>
        <span><i className="dot hoje" /> Hoje</span>
      </div>

      <button className="preencher-btn" onClick={() => setPreAberto(true)}>
        ⚡ Preencher o mês com um padrão
      </button>

      {/* Sheet: preencher o mes */}
      <Sheet open={preAberto} title="Preencher o mês" onClose={() => setPreAberto(false)}>
        <div className="horas-label" style={{ marginTop: 0 }}>Quais dias?</div>
        <div className="brush-bar" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {([["todos", "Todos"], ["uteis", "Seg–Sex"], ["fds", "Sáb/Dom"]] as [Escopo, string][]).map(
            ([id, lbl]) => (
              <button
                key={id}
                className={`brush ${escopo === id ? "active" : ""}`}
                onClick={() => setEscopo(id)}
              >
                {lbl}
              </button>
            )
          )}
        </div>

        <div className="horas-label">Horas por dia</div>
        <div className="stepper">
          <button onClick={() => setHorasPadrao((h) => Math.max(1, Math.round((h - 0.5) * 10) / 10))}>−</button>
          <div className="valor">
            <b>{horasPadrao}</b>
            <small>horas</small>
          </div>
          <button onClick={() => setHorasPadrao((h) => Math.min(24, Math.round((h + 0.5) * 10) / 10))}>+</button>
        </div>
        <div className="chips" style={{ marginTop: 14, justifyContent: "center" }}>
          {PRESETS.map((p) => (
            <div key={p} className={`chip ${horasPadrao === p ? "active" : ""}`} onClick={() => setHorasPadrao(p)}>
              {p}h
            </div>
          ))}
        </div>

        <button className="btn primary" style={{ marginTop: 22 }} onClick={() => preencher("trabalho")}>
          Marcar como trabalho ({horasPadrao}h)
        </button>
        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => preencher("folga")}>
          Marcar tudo como folga
        </button>
        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => preencher("limpar")}>
          Limpar o mês
        </button>
      </Sheet>

      {/* Sheet: editar um dia */}
      <Sheet open={aberto} title={diaSel ? dataLonga(diaSel) : ""} onClose={() => setAberto(false)}>
        <div className="modo-row">
          <button className={`modo ${modo === "trabalhar" ? "active" : ""}`} onClick={() => setModo("trabalhar")}>
            🚗 Trabalhar
          </button>
          <button className={`modo ${modo === "folga" ? "active folga" : ""}`} onClick={() => setModo("folga")}>
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
                <div key={p} className={`chip ${horas === p ? "active" : ""}`} onClick={() => setHoras(p)}>
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
          <button className="btn ghost block" style={{ marginTop: 10 }} onClick={limparDia}>
            Limpar plano do dia
          </button>
        )}
      </Sheet>
    </Page>
  );
}
