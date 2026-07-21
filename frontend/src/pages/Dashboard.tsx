import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Page from "../components/Page";
import TurnoControl from "../components/TurnoControl";
import MapaRota from "../components/MapaRota";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useTurno } from "../lib/turno";
import { brl } from "../lib/format";
import type { DashboardResumo } from "../lib/types";

type Periodo = "diaria" | "semanal" | "mensal";
const labels: Record<Periodo, string> = { diaria: "Hoje", semanal: "Semana", mensal: "Mês" };

export default function Dashboard() {
  const { user } = useAuth();
  const { rodando, pontos, kmGps, gpsErro } = useTurno();
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>("semanal");
  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [mapaFull, setMapaFull] = useState(false);

  useEffect(() => {
    setCarregando(true);
    setErro(false);
    api
      .get<DashboardResumo>(`/dashboard/resumo?periodo=${periodo}`)
      .then((r) => setResumo(r))
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, [periodo, recarga]);

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
        <div className="avatar">{iniciais}</div>
      </div>

      <TurnoControl />

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
    </Page>
  );
}
