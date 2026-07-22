import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Page from "../components/Page";
import Sheet from "../components/Sheet";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { brl } from "../lib/format";
import type { Aluguel, LocadoraResumo } from "../lib/types";

const DIAS_SEM = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function vencLabel(a: Aluguel): string {
  if (a.periodicidade === "semanal") return `toda ${DIAS_SEM[a.dia_vencimento] ?? "Seg"}`;
  return `dia ${a.dia_vencimento}`;
}
function statusInfo(s: Aluguel["status"]): { label: string; cls: string } {
  if (s === "em_dia") return { label: "Em dia", cls: "ok" };
  if (s === "atrasado") return { label: "Atrasado", cls: "late" };
  if (s === "inativo") return { label: "Inativo", cls: "off" };
  return { label: "A vencer", cls: "wait" };
}

export default function Locadora() {
  const { user, logout } = useAuth();
  const [lista, setLista] = useState<Aluguel[]>([]);
  const [resumo, setResumo] = useState<LocadoraResumo | null>(null);
  const [carregando, setCarregando] = useState(true);

  // criar
  const [novoAberto, setNovoAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [carro, setCarro] = useState("");
  const [valor, setValor] = useState("");
  const [periodicidade, setPeriodicidade] = useState<"semanal" | "mensal">("semanal");
  const [dia, setDia] = useState(4); // sexta
  const [salvando, setSalvando] = useState(false);

  // detalhe
  const [sel, setSel] = useState<Aluguel | null>(null);

  function carregar() {
    setCarregando(true);
    Promise.all([
      api.get<Aluguel[]>("/alugueis"),
      api.get<LocadoraResumo>("/alugueis/resumo"),
    ])
      .then(([l, r]) => { setLista(l); setResumo(r); })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }
  useEffect(carregar, []);

  async function criar() {
    const v = parseFloat(valor.replace(",", "."));
    if (!email || !v || v <= 0 || salvando) return;
    setSalvando(true);
    try {
      await api.post<Aluguel>("/alugueis", {
        motorista_email: email,
        carro: carro || null,
        valor: v,
        periodicidade,
        dia_vencimento: dia,
      });
      setNovoAberto(false);
      setEmail(""); setCarro(""); setValor("");
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function marcarPago() {
    if (!sel) return;
    await api.post(`/alugueis/${sel.id}/pagamento`, {});
    setSel(null);
    carregar();
  }

  async function remover() {
    if (!sel) return;
    await api.del(`/alugueis/${sel.id}`);
    setSel(null);
    carregar();
  }

  const diasDisponiveis =
    periodicidade === "semanal"
      ? DIAS_SEM.map((d, i) => ({ v: i, label: d }))
      : Array.from({ length: 28 }, (_, i) => ({ v: i + 1, label: String(i + 1) }));

  return (
    <Page>
      <div className="topbar">
        <div>
          <div className="hello">Painel da locadora</div>
          <div className="name">{user?.nome.split(" ")[0]}</div>
        </div>
        <button className="icon-btn" onClick={logout} aria-label="Sair">⇥</button>
      </div>

      {/* Resumo */}
      {resumo && (
        <div className="stat-grid" style={{ marginBottom: 12 }}>
          <div className="stat">
            <div className="k">🚙 Carros alugados</div>
            <div className="v">{resumo.alugueis_ativos}</div>
          </div>
          <div className="stat">
            <div className="k">💰 Receita/mês</div>
            <div className="v" style={{ fontSize: 18 }}>{brl(resumo.receita_mensal_prevista)}</div>
          </div>
          <div className="stat">
            <div className="k">⏳ A vencer (7d)</div>
            <div className="v">{resumo.a_vencer_7dias}</div>
          </div>
          <div className="stat">
            <div className="k">🔴 Atrasados</div>
            <div className="v" style={{ color: resumo.atrasados ? "var(--neg)" : "var(--text)" }}>
              {resumo.atrasados}
            </div>
          </div>
        </div>
      )}

      <button className="btn primary" style={{ marginBottom: 8 }} onClick={() => setNovoAberto(true)}>
        + Novo aluguel
      </button>

      <div className="section-title">
        <h3>Aluguéis</h3>
      </div>

      {carregando ? (
        <div className="loading"><div className="spinner" /></div>
      ) : lista.length === 0 ? (
        <div className="empty">
          <div className="emoji">🔑</div>
          <p>Nenhum aluguel ainda.</p>
          <p style={{ marginTop: 6 }}>Toque em “Novo aluguel” e atribua um carro a um motorista pelo e-mail.</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {lista.map((a) => {
            const st = statusInfo(a.status);
            return (
              <motion.div
                key={a.id}
                className="row"
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                onClick={() => setSel(a)}
              >
                <div className="ic">🚙</div>
                <div className="body">
                  <div className="t">{a.motorista_nome ?? a.motorista_email}</div>
                  <div className="s">
                    {a.carro ? `${a.carro} · ` : ""}{brl(a.valor)} · {vencLabel(a)}
                    {!a.vinculado && " · sem conta ainda"}
                  </div>
                </div>
                <span className={`stag ${st.cls}`}>{st.label}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}

      {/* Criar aluguel */}
      <Sheet open={novoAberto} title="Novo aluguel" onClose={() => setNovoAberto(false)}>
        <div className="field">
          <label>E-mail do motorista</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="motorista@email.com" />
          <div className="hint">Ele vê o aluguel no app quando criar/entrar com esse e-mail.</div>
        </div>
        <div className="field">
          <label>Carro (opcional)</label>
          <input value={carro} onChange={(e) => setCarro(e.target.value)} placeholder="Ex: Onix ABC1D23" />
        </div>
        <div className="field">
          <label>Valor do aluguel (R$)</label>
          <input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00" />
        </div>
        <div className="field">
          <label>Cobrança</label>
          <div className="papel-row">
            <button type="button" className={`papel ${periodicidade === "semanal" ? "active" : ""}`}
              onClick={() => { setPeriodicidade("semanal"); setDia(4); }}>Semanal</button>
            <button type="button" className={`papel ${periodicidade === "mensal" ? "active" : ""}`}
              onClick={() => { setPeriodicidade("mensal"); setDia(5); }}>Mensal</button>
          </div>
        </div>
        <div className="field">
          <label>{periodicidade === "semanal" ? "Vence toda" : "Vence no dia"}</label>
          <div className="dia-chips">
            {diasDisponiveis.map((d) => (
              <button key={d.v} type="button" className={`chip ${dia === d.v ? "active" : ""}`} onClick={() => setDia(d.v)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn primary" disabled={salvando || !email || !valor} style={{ marginTop: 8 }} onClick={criar}>
          {salvando ? "Salvando..." : "Criar aluguel"}
        </button>
      </Sheet>

      {/* Detalhe do aluguel */}
      <Sheet open={!!sel} title={sel ? (sel.motorista_nome ?? sel.motorista_email) : ""} onClose={() => setSel(null)}>
        {sel && (
          <>
            <div className="hero" style={{ marginBottom: 16, padding: 16 }}>
              <div className="label">{sel.carro ?? "Aluguel"} · {vencLabel(sel)}</div>
              <div className="big pos" style={{ fontSize: 30 }}>{brl(sel.valor)}</div>
              <div className="sub">
                {statusInfo(sel.status).label}
                {sel.prox_vencimento && sel.dias_restantes !== null && (
                  <> · próximo vencimento em {sel.dias_restantes} {sel.dias_restantes === 1 ? "dia" : "dias"}</>
                )}
              </div>
            </div>
            <div className="vp-linhas" style={{ marginBottom: 16 }}>
              <div className="vp-linha"><span>Motorista</span><b>{sel.motorista_email}</b></div>
              <div className="vp-linha"><span>Vínculo</span><b>{sel.vinculado ? "conta ativa" : "aguardando cadastro"}</b></div>
              <div className="vp-linha"><span>Último pagamento</span><b>{sel.ultimo_pagamento ?? "—"}</b></div>
            </div>
            <button className="btn primary" onClick={marcarPago}>✓ Registrar pagamento ({brl(sel.valor)})</button>
            <button className="btn ghost block" style={{ marginTop: 10 }} onClick={remover}>Remover aluguel</button>
          </>
        )}
      </Sheet>
    </Page>
  );
}
