import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Page from "../components/Page";
import Sheet from "../components/Sheet";
import TurnoControl from "../components/TurnoControl";
import MapaRota from "../components/MapaRota";
import GraficoGanhos from "../components/GraficoGanhos";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useTurno } from "../lib/turno";
import { brl, hojeISO } from "../lib/format";
import type { AgendaDia, Aluguel, DashboardResumo, Insight, SerieDia } from "../lib/types";

type Periodo = "diaria" | "semanal" | "mensal";
const labels: Record<Periodo, string> = { diaria: "Hoje", semanal: "Semana", mensal: "Mês" };

export default function Dashboard() {
  const { user } = useAuth();
  const { rodando, pontos, kmGps, gpsErro } = useTurno();
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>("diaria");
  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [mapaFull, setMapaFull] = useState(false);
  const [menu, setMenu] = useState(false);
  const [planoHoje, setPlanoHoje] = useState<AgendaDia | null>(null);
  const [serie, setSerie] = useState<SerieDia[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [aluguel, setAluguel] = useState<Aluguel | null>(null);
  const [avisoFechado, setAvisoFechado] = useState(false);

  useEffect(() => {
    setCarregando(true);
    setErro(false);
    api
      .get<DashboardResumo>(`/dashboard/resumo?periodo=${periodo}&hoje=${hojeISO()}`)
      .then((r) => setResumo(r))
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, [periodo, recarga]);

  useEffect(() => {
    const hoje = hojeISO();
    api
      .get<AgendaDia[]>(`/agenda?inicio=${hoje}&fim=${hoje}`)
      .then((l) => setPlanoHoje(l[0] ?? null))
      .catch(() => setPlanoHoje(null));
    api.get<SerieDia[]>(`/dashboard/serie?dias=14&hoje=${hoje}`).then(setSerie).catch(() => setSerie([]));
    api.get<Insight[]>(`/dashboard/insights?hoje=${hoje}`).then(setInsights).catch(() => setInsights([]));
    api.get<Aluguel[]>("/alugueis/meu").then((l) => setAluguel(l[0] ?? null)).catch(() => setAluguel(null));
  }, [recarga]);

  function irPara(rota: string) {
    setMenu(false);
    navigate(rota);
  }

  const iniciais = user?.nome.slice(0, 2).toUpperCase() ?? "??";
  const lucro = resumo?.lucro_liquido ?? 0;
  const progresso = resumo?.meta_progresso ?? null;

  return (
    <Page>
      <div className="topbar">
        <div>
          <div className="hello">Boa jornada,</div>
          <div className="name">{user?.nome.split(" ")[0]}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Menu">
            ☰
          </button>
          <div className="avatar">{iniciais}</div>
        </div>
      </div>

      <TurnoControl />

      {/* Atalho da Agenda */}
      <button className="agenda-shortcut" onClick={() => navigate("/agenda")}>
        <div className="ico">📅</div>
        <div className="txt">
          <div className="t">Agenda</div>
          <div className="s">
            {planoHoje?.trabalhar
              ? `Hoje: meta de ${planoHoje.horas_alvo}h de trabalho`
              : planoHoje && !planoHoje.trabalhar
              ? "Hoje é dia de folga 😴"
              : "Planeje seus dias e horas de trabalho"}
          </div>
        </div>
        <div className="chev">›</div>
      </button>

      {aluguel && (
        <div className={`aluguel-card ${aluguel.status}`}>
          <div className="al-ico">🔑</div>
          <div className="al-body">
            <div className="al-top">
              <span className="al-t">Aluguel do carro{aluguel.carro ? ` · ${aluguel.carro}` : ""}</span>
              <span className="al-val">{brl(aluguel.valor)}</span>
            </div>
            <div className="al-sub">
              {aluguel.status === "atrasado"
                ? "⚠️ Pagamento em atraso"
                : aluguel.status === "em_dia"
                ? "✓ Em dia"
                : aluguel.dias_restantes !== null
                ? `Vence em ${aluguel.dias_restantes} ${aluguel.dias_restantes === 1 ? "dia" : "dias"}`
                : "Aluguel ativo"}
              {aluguel.periodicidade === "semanal" ? " · semanal" : " · mensal"}
            </div>
          </div>
        </div>
      )}

      {(rodando || pontos.length > 0) && (
        <div className="mapa-card">
          <div className="mapa-badge">
            {rodando && <span className="live-dot" />}
            <span className="km">{kmGps.toLocaleString("pt-BR")} km</span>
          </div>
          <button className="mapa-expand" onClick={() => setMapaFull(true)}>
            Ampliar ⤢
          </button>
          <MapaRota pontos={pontos} height={180} follow={rodando} />
        </div>
      )}

      {rodando && gpsErro && (
        <div className="error-msg" style={{ marginBottom: 18 }}>
          GPS: {gpsErro}. Ative a localização e mantenha o app aberto para traçar a rota.
        </div>
      )}

      {insights[0] && !avisoFechado && (
        <div className={`aviso-note ${insights[0].nivel}`}>
          <span className="an-ico">{insights[0].icone}</span>
          <span className="an-txt">
            <b>{insights[0].titulo}.</b> {insights[0].texto}
          </span>
          <button className="an-x" onClick={() => setAvisoFechado(true)} aria-label="Dispensar">
            ✕
          </button>
        </div>
      )}

      <div className="segment" style={{ marginBottom: 18 }}>
        {(Object.keys(labels) as Periodo[]).map((p) => (
          <button key={p} className={p === periodo ? "active" : ""} onClick={() => setPeriodo(p)}>
            {labels[p]}
          </button>
        ))}
      </div>

      {erro ? (
        <div className="empty">
          <div className="emoji">📡</div>
          <p>Não foi possível carregar seus números.</p>
          <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => setRecarga((n) => n + 1)}>
            Tentar de novo
          </button>
        </div>
      ) : carregando || !resumo ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="hero">
            <div className="label">Lucro líquido — {labels[periodo].toLowerCase()}</div>
            <div className={`big ${lucro >= 0 ? "pos" : "neg"}`}>{brl(lucro)}</div>
            <div className="sub">
              {brl(resumo.ganho_bruto)} em ganhos &nbsp;·&nbsp; {brl(resumo.total_gastos)} em gastos
            </div>

            {progresso !== null && resumo.meta_valor ? (
              <>
                <div className="meta-bar">
                  <span style={{ width: `${Math.min(progresso * 100, 100)}%` }} />
                </div>
                <div className="sub" style={{ marginTop: 8 }}>
                  {Math.round(progresso * 100)}% da meta de {brl(resumo.meta_valor)}
                </div>
              </>
            ) : (
              <div className="sub" style={{ marginTop: 10 }}>
                <span style={{ color: "var(--accent)" }} onClick={() => navigate("/metas")}>
                  Defina uma meta {labels[periodo].toLowerCase()} →
                </span>
              </div>
            )}
          </div>

          <div className="section-title">
            <h3>Desempenho</h3>
          </div>
          <div className="stat-grid">
            <div className="stat">
              <div className="k">⏱️ Por hora</div>
              <div className="v">{resumo.horas_trabalhadas > 0 ? brl(resumo.lucro_por_hora) : "—"}</div>
            </div>
            <div className="stat">
              <div className="k">🛣️ Por km</div>
              <div className="v">{resumo.km_rodado > 0 ? brl(resumo.lucro_por_km) : "—"}</div>
            </div>
            <div className="stat">
              <div className="k">🚗 Corridas</div>
              <div className="v">
                {resumo.num_corridas} <small>· {brl(resumo.ganho_por_corrida)}/un</small>
              </div>
            </div>
            <div className="stat">
              <div className="k">📅 Dias · horas</div>
              <div className="v">
                {resumo.dias_trabalhados}d <small>· {resumo.horas_trabalhadas}h</small>
              </div>
            </div>
          </div>

          <div className="stat-grid" style={{ marginTop: 12 }}>
            <div className="stat">
              <div className="k">📈 Km rodados</div>
              <div className="v">
                {resumo.km_rodado.toLocaleString("pt-BR")} <small>km</small>
              </div>
            </div>
            <div className="stat">
              <div className="k">💰 Ganho bruto</div>
              <div className="v">{brl(resumo.ganho_bruto)}</div>
            </div>
          </div>
        </>
      )}

      {serie.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 8 }}>
            <h3>Ganhos — 14 dias</h3>
          </div>
          <GraficoGanhos serie={serie} />
        </>
      )}

      {mapaFull && (
        <div className="mapa-full">
          <div className="barra">
            <div>
              <div className="hello">Rota do turno</div>
              <div className="km-big">{kmGps.toLocaleString("pt-BR")} km</div>
            </div>
            <button className="fechar" onClick={() => setMapaFull(false)}>
              ✕
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <MapaRota pontos={pontos} height="100%" follow={rodando} />
          </div>
        </div>
      )}

      <Sheet open={menu} title="Menu" onClose={() => setMenu(false)}>
        <div className="menu-list">
          <button className="menu-item" onClick={() => irPara("/agenda")}>
            <span className="mi-ico">📅</span>
            <span className="mi-txt">
              <b>Agenda</b>
              <small>Planeje dias e horas de trabalho</small>
            </span>
            <span className="chev">›</span>
          </button>
          <button className="menu-item" onClick={() => irPara("/metas")}>
            <span className="mi-ico">🎯</span>
            <span className="mi-txt">
              <b>Metas</b>
              <small>Objetivos de lucro por período</small>
            </span>
            <span className="chev">›</span>
          </button>
          <button className="menu-item" onClick={() => irPara("/ajustes")}>
            <span className="mi-ico">⚙️</span>
            <span className="mi-txt">
              <b>Ajustes</b>
              <small>Custo do carro, plataformas e conta</small>
            </span>
            <span className="chev">›</span>
          </button>
        </div>
      </Sheet>
    </Page>
  );
}
