import { useEffect, useState } from "react";
import Page from "../components/Page";
import { api, getToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import { brl } from "../lib/format";
import { abrirAcessibilidade, configurarCaptura, ehAppNativo, statusCaptura } from "../lib/nativo";
import type { Config, PlataformaComparacao } from "../lib/types";

export default function Ajustes() {
  const { user, logout } = useAuth();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [comp, setComp] = useState<PlataformaComparacao[]>([]);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [capturaAtiva, setCapturaAtiva] = useState(false);

  useEffect(() => {
    api.get<Config>("/config").then(setCfg);
    api.get<PlataformaComparacao[]>("/dashboard/plataformas?periodo=mensal").then(setComp);
    statusCaptura().then((s) => setCapturaAtiva(!!s?.acessibilidade));
  }, []);

  // Sempre que o custo por km é carregado, repassa para o serviço nativo.
  useEffect(() => {
    if (cfg && ehAppNativo()) {
      const t = getToken();
      if (t) configurarCaptura(t, cfg.custo_por_km);
    }
  }, [cfg]);

  function set(campo: keyof Config, valor: string) {
    if (!cfg) return;
    setCfg({ ...cfg, [campo]: parseFloat(valor.replace(",", ".")) || 0 });
    setSalvo(false);
  }

  async function salvar() {
    if (!cfg) return;
    setSalvando(true);
    try {
      const res = await api.put<Config>("/config", {
        preco_combustivel: cfg.preco_combustivel,
        consumo_km_l: cfg.consumo_km_l,
        manutencao_por_km: cfg.manutencao_por_km,
        custo_fixo_diario: cfg.custo_fixo_diario,
        meta_lucro_por_km: cfg.meta_lucro_por_km,
      });
      setCfg(res);
      setSalvo(true);
    } finally {
      setSalvando(false);
    }
  }

  const maxTotal = Math.max(...comp.map((c) => c.total), 1);

  return (
    <Page>
      <div className="topbar">
        <div className="name" style={{ fontSize: 24 }}>
          Ajustes
        </div>
      </div>

      {/* Custo do carro */}
      <div className="section-title">
        <h3>💰 Custo do seu carro</h3>
      </div>
      {cfg && (
        <div className="card">
          <div className="hero" style={{ marginBottom: 18, padding: 16 }}>
            <div className="label">Seu custo real por km</div>
            <div className="big" style={{ fontSize: 32 }}>
              {brl(cfg.custo_por_km)}
            </div>
            <div className="sub">É quanto cada km rodado te custa (combustível + desgaste).</div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Combustível (R$/litro)</label>
              <input
                type="text"
                inputMode="decimal"
                value={cfg.preco_combustivel}
                onChange={(e) => set("preco_combustivel", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Consumo (km/litro)</label>
              <input
                type="text"
                inputMode="decimal"
                value={cfg.consumo_km_l}
                onChange={(e) => set("consumo_km_l", e.target.value)}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Desgaste (R$/km)</label>
              <input
                type="text"
                inputMode="decimal"
                value={cfg.manutencao_por_km}
                onChange={(e) => set("manutencao_por_km", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Custo fixo/dia (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={cfg.custo_fixo_diario}
                onChange={(e) => set("custo_fixo_diario", e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Alvo de lucro por km (R$) — opcional</label>
            <input
              type="text"
              inputMode="decimal"
              value={cfg.meta_lucro_por_km}
              onChange={(e) => set("meta_lucro_por_km", e.target.value)}
            />
            <div className="hint">Acima desse lucro por km, a corrida é marcada como “ótima”.</div>
          </div>
          <button className="btn primary" disabled={salvando} onClick={salvar}>
            {salvando ? "Salvando..." : salvo ? "✓ Salvo" : "Salvar custos"}
          </button>
        </div>
      )}

      {/* Captura automática (só no app Android) */}
      {ehAppNativo() && (
        <>
          <div className="section-title" style={{ marginTop: 30 }}>
            <h3>🤖 Captura automática</h3>
          </div>
          <div className="card">
            <div style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 14 }}>
              Quando a oferta aparece na tela da Uber/99, o Volante mostra na hora se vale a pena e deixa você
              registrar a corrida com um toque.
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: capturaAtiva ? "var(--accent)" : "var(--text-faint)",
                }}
              />
              {capturaAtiva ? "Acessibilidade ativa" : "Acessibilidade desativada"}
            </div>
            <button
              className="btn primary block"
              onClick={() => abrirAcessibilidade().then(() => statusCaptura().then((s) => setCapturaAtiva(!!s?.acessibilidade)))}
            >
              {capturaAtiva ? "Abrir configurações de acessibilidade" : "Ativar captura"}
            </button>
            <div className="hint" style={{ marginTop: 10 }}>
              Nas configurações, ative o serviço <b>Volante — captura de ofertas</b>. Ele só lê a tela da Uber/99.
            </div>
          </div>
        </>
      )}

      {/* Comparador de plataformas */}
      <div className="section-title" style={{ marginTop: 30 }}>
        <h3>⚖️ Plataformas (mês)</h3>
      </div>
      {comp.length === 0 ? (
        <div className="empty" style={{ padding: "30px 20px" }}>
          <div className="emoji">📊</div>
          <p>Registre corridas com o km pra comparar as plataformas.</p>
        </div>
      ) : (
        <div className="card">
          {comp.map((c) => (
            <div className="comp-item" key={c.plataforma}>
              <div className="comp-top">
                <span className="nome">{c.plataforma}</span>
                <span className="tot">
                  {brl(c.total)} <small style={{ color: "var(--text-dim)" }}>· {Math.round(c.percentual * 100)}%</small>
                </span>
              </div>
              <div className="comp-bar">
                <span style={{ width: `${(c.total / maxTotal) * 100}%` }} />
              </div>
              <div className="comp-meta">
                <span>{c.num_corridas} corridas</span>
                <span>{brl(c.r_por_corrida)}/corrida</span>
                {c.r_por_km > 0 && <span>{brl(c.r_por_km)}/km</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conta */}
      <div className="section-title" style={{ marginTop: 30 }}>
        <h3>👤 Conta</h3>
      </div>
      <div className="card">
        <div style={{ fontWeight: 600 }}>{user?.nome}</div>
        <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 2 }}>{user?.email}</div>
        <button className="btn ghost block" style={{ marginTop: 16 }} onClick={logout}>
          Sair da conta
        </button>
      </div>
    </Page>
  );
}
