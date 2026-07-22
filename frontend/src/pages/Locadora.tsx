import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Page from "../components/Page";
import Sheet from "../components/Sheet";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { brl } from "../lib/format";
import type { Aluguel, Carro, LocadoraResumo } from "../lib/types";

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
function detalheCarro(c: Carro): string {
  return [c.placa, c.ano, c.cor, c.km ? `${c.km.toLocaleString("pt-BR")} km` : null, c.combustivel]
    .filter(Boolean)
    .join(" · ");
}

export default function Locadora() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [aba, setAba] = useState<"alugueis" | "carros">("alugueis");
  const [lista, setLista] = useState<Aluguel[]>([]);
  const [carros, setCarros] = useState<Carro[]>([]);
  const [resumo, setResumo] = useState<LocadoraResumo | null>(null);
  const [carregando, setCarregando] = useState(true);

  // criar aluguel
  const [novoAberto, setNovoAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [carroId, setCarroId] = useState<string>("");
  const [valor, setValor] = useState("");
  const [periodicidade, setPeriodicidade] = useState<"semanal" | "mensal">("semanal");
  const [dia, setDia] = useState(4);
  const [salvando, setSalvando] = useState(false);

  // carro (add/edit)
  const [carroAberto, setCarroAberto] = useState(false);
  const [cModelo, setCModelo] = useState("");
  const [cPlaca, setCPlaca] = useState("");
  const [cAno, setCAno] = useState("");
  const [cCor, setCCor] = useState("");
  const [cKm, setCKm] = useState("");
  const [cComb, setCComb] = useState("");
  const [cValor, setCValor] = useState("");

  const [sel, setSel] = useState<Aluguel | null>(null);
  const [selCarro, setSelCarro] = useState<Carro | null>(null);

  function carregar() {
    setCarregando(true);
    Promise.all([
      api.get<Aluguel[]>("/alugueis"),
      api.get<LocadoraResumo>("/alugueis/resumo"),
      api.get<Carro[]>("/carros"),
    ])
      .then(([l, r, cs]) => { setLista(l); setResumo(r); setCarros(cs); })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }
  useEffect(carregar, []);

  const disponiveis = carros.filter((c) => c.disponivel);
  const trocasPendentes = lista.filter((a) => a.troca_status === "solicitada").length;

  async function criarAluguel() {
    const v = parseFloat(valor.replace(",", "."));
    if (!email || !v || v <= 0 || salvando) return;
    setSalvando(true);
    try {
      await api.post<Aluguel>("/alugueis", {
        motorista_email: email,
        carro_id: carroId || null,
        valor: v,
        periodicidade,
        dia_vencimento: dia,
      });
      setNovoAberto(false);
      setEmail(""); setCarroId(""); setValor("");
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function criarCarro() {
    if (!cModelo || salvando) return;
    setSalvando(true);
    try {
      await api.post<Carro>("/carros", {
        modelo: cModelo,
        placa: cPlaca || null,
        ano: cAno ? parseInt(cAno, 10) : null,
        cor: cCor || null,
        km: cKm ? parseInt(cKm.replace(/\D/g, ""), 10) : null,
        combustivel: cComb || null,
        valor_sugerido: cValor ? parseFloat(cValor.replace(",", ".")) : null,
      });
      setCarroAberto(false);
      setCModelo(""); setCPlaca(""); setCAno(""); setCCor(""); setCKm(""); setCComb(""); setCValor("");
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function marcarPago() {
    if (!sel) return;
    await api.post(`/alugueis/${sel.id}/pagamento`, {});
    setSel(null); carregar();
  }
  async function removerAluguel() {
    if (!sel) return;
    await api.del(`/alugueis/${sel.id}`);
    setSel(null); carregar();
  }
  async function aprovarTroca() {
    if (!sel) return;
    await api.post(`/alugueis/${sel.id}/aprovar-troca`, {});
    setSel(null); carregar();
  }
  async function recusarTroca() {
    if (!sel) return;
    await api.post(`/alugueis/${sel.id}/recusar-troca`, {});
    setSel(null); carregar();
  }
  async function removerCarro() {
    if (!selCarro) return;
    try {
      await api.del(`/carros/${selCarro.id}`);
      setSelCarro(null); carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível remover");
    }
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
        <div style={{ display: "flex", gap: 10 }}>
          <button className="icon-btn" onClick={() => navigate("/ajuda")} aria-label="Ajuda">❓</button>
          <button className="icon-btn" onClick={logout} aria-label="Sair">⇥</button>
        </div>
      </div>

      {resumo && (
        <div className="stat-grid" style={{ marginBottom: 14 }}>
          <div className="stat">
            <div className="k">🚙 Alugados · frota</div>
            <div className="v">{resumo.alugueis_ativos} <small>/ {carros.length}</small></div>
          </div>
          <div className="stat">
            <div className="k">💰 Receita/mês (est.)</div>
            <div className="v" style={{ fontSize: 18 }}>{brl(resumo.receita_mensal_prevista)}</div>
          </div>
          <div className="stat">
            <div className="k">⏳ A vencer (7d)</div>
            <div className="v">{resumo.a_vencer_7dias}</div>
          </div>
          <div className="stat">
            <div className="k">🔴 Atrasados</div>
            <div className="v" style={{ color: resumo.atrasados ? "var(--neg)" : "var(--text)" }}>{resumo.atrasados}</div>
          </div>
        </div>
      )}

      <div className="segment" style={{ marginBottom: 16 }}>
        <button className={aba === "alugueis" ? "active" : ""} onClick={() => setAba("alugueis")}>
          Aluguéis{trocasPendentes > 0 ? ` (${trocasPendentes}⇄)` : ""}
        </button>
        <button className={aba === "carros" ? "active" : ""} onClick={() => setAba("carros")}>
          Carros ({carros.length})
        </button>
      </div>

      {carregando ? (
        <div className="loading"><div className="spinner" /></div>
      ) : aba === "alugueis" ? (
        <>
          <button className="btn primary" style={{ marginBottom: 14 }} onClick={() => setNovoAberto(true)}>
            + Novo aluguel
          </button>
          {lista.length === 0 ? (
            <div className="empty">
              <div className="emoji">🔑</div>
              <p>Nenhum aluguel ainda.</p>
              <p style={{ marginTop: 6 }}>Cadastre carros e atribua a um motorista pelo e-mail.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {lista.map((a) => {
                const st = statusInfo(a.status);
                return (
                  <motion.div key={a.id} className="row" layout
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    onClick={() => setSel(a)}>
                    <div className="ic">🚙</div>
                    <div className="body">
                      <div className="t">{a.motorista_nome ?? a.motorista_email}</div>
                      <div className="s">
                        {a.carro ? `${a.carro} · ` : ""}{brl(a.valor)} · {vencLabel(a)}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                      {a.troca_status === "solicitada" && <span className="stag wait">Troca ⇄</span>}
                      <span className={`stag ${st.cls}`}>{st.label}</span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </>
      ) : (
        <>
          <button className="btn primary" style={{ marginBottom: 14 }} onClick={() => setCarroAberto(true)}>
            + Adicionar carro
          </button>
          {carros.length === 0 ? (
            <div className="empty">
              <div className="emoji">🚗</div>
              <p>Catálogo vazio.</p>
              <p style={{ marginTop: 6 }}>Adicione seus carros com placa, ano e detalhes.</p>
            </div>
          ) : (
            carros.map((c) => (
              <div key={c.id} className="row" onClick={() => setSelCarro(c)}>
                <div className="ic">🚗</div>
                <div className="body">
                  <div className="t">{c.modelo}</div>
                  <div className="s">{detalheCarro(c) || "sem detalhes"}</div>
                </div>
                <span className={`stag ${c.disponivel ? "ok" : "off"}`}>
                  {c.disponivel ? "Livre" : "Alugado"}
                </span>
              </div>
            ))
          )}
        </>
      )}

      {/* Criar aluguel */}
      <Sheet open={novoAberto} title="Novo aluguel" onClose={() => setNovoAberto(false)}>
        <div className="field">
          <label>E-mail do motorista</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="motorista@email.com" />
          <div className="hint">Ele vê o aluguel no app ao entrar com esse e-mail.</div>
        </div>
        <div className="field">
          <label>Carro (do catálogo)</label>
          {disponiveis.length === 0 ? (
            <div className="hint">Nenhum carro livre. Adicione na aba “Carros”.</div>
          ) : (
            <div className="carro-pick">
              {disponiveis.map((c) => (
                <button key={c.id} type="button"
                  className={`carro-opt ${carroId === c.id ? "active" : ""}`}
                  onClick={() => { setCarroId(c.id); if (c.valor_sugerido) setValor(String(c.valor_sugerido).replace(".", ",")); }}>
                  <b>{c.modelo}</b>
                  <small>{detalheCarro(c) || "—"}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="field">
          <label>Valor do aluguel (R$)</label>
          <input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00" />
        </div>
        <div className="field">
          <label>Cobrança</label>
          <div className="papel-row">
            <button type="button" className={`papel ${periodicidade === "semanal" ? "active" : ""}`} onClick={() => { setPeriodicidade("semanal"); setDia(4); }}>Semanal</button>
            <button type="button" className={`papel ${periodicidade === "mensal" ? "active" : ""}`} onClick={() => { setPeriodicidade("mensal"); setDia(5); }}>Mensal</button>
          </div>
        </div>
        <div className="field">
          <label>{periodicidade === "semanal" ? "Vence toda" : "Vence no dia"}</label>
          <div className="dia-chips">
            {diasDisponiveis.map((d) => (
              <button key={d.v} type="button" className={`chip ${dia === d.v ? "active" : ""}`} onClick={() => setDia(d.v)}>{d.label}</button>
            ))}
          </div>
        </div>
        <button className="btn primary" disabled={salvando || !email || !valor} style={{ marginTop: 8 }} onClick={criarAluguel}>
          {salvando ? "Salvando..." : "Criar aluguel"}
        </button>
      </Sheet>

      {/* Adicionar carro */}
      <Sheet open={carroAberto} title="Adicionar carro" onClose={() => setCarroAberto(false)}>
        <div className="field">
          <label>Modelo</label>
          <input value={cModelo} onChange={(e) => setCModelo(e.target.value)} placeholder="Ex: Chevrolet Onix 2022" />
        </div>
        <div className="field-row">
          <div className="field"><label>Placa</label><input value={cPlaca} onChange={(e) => setCPlaca(e.target.value.toUpperCase())} placeholder="ABC1D23" /></div>
          <div className="field"><label>Ano</label><input inputMode="numeric" value={cAno} onChange={(e) => setCAno(e.target.value.replace(/\D/g, ""))} placeholder="2022" /></div>
        </div>
        <div className="field-row">
          <div className="field"><label>Cor</label><input value={cCor} onChange={(e) => setCCor(e.target.value)} placeholder="Prata" /></div>
          <div className="field"><label>KM</label><input inputMode="numeric" value={cKm} onChange={(e) => setCKm(e.target.value.replace(/\D/g, ""))} placeholder="45000" /></div>
        </div>
        <div className="field-row">
          <div className="field"><label>Combustível</label><input value={cComb} onChange={(e) => setCComb(e.target.value)} placeholder="Flex / GNV" /></div>
          <div className="field"><label>Aluguel sugerido</label><input inputMode="decimal" value={cValor} onChange={(e) => setCValor(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="600" /></div>
        </div>
        <button className="btn primary" disabled={salvando || !cModelo} style={{ marginTop: 8 }} onClick={criarCarro}>
          {salvando ? "Salvando..." : "Adicionar ao catálogo"}
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
                  <> · vence em {sel.dias_restantes} {sel.dias_restantes === 1 ? "dia" : "dias"}</>
                )}
              </div>
            </div>

            {sel.troca_status === "solicitada" && (
              <div className="aviso-note atencao" style={{ marginBottom: 16 }}>
                <span className="an-ico">⇄</span>
                <span className="an-txt"><b>Troca pedida.</b> O motorista quer trocar para <b>{sel.carro_desejado}</b>.</span>
              </div>
            )}
            {sel.troca_status === "solicitada" && (
              <div className="field-row" style={{ marginBottom: 8 }}>
                <button className="btn primary" onClick={aprovarTroca}>Aprovar troca</button>
                <button className="btn ghost" onClick={recusarTroca}>Recusar</button>
              </div>
            )}

            <div className="vp-linhas" style={{ marginBottom: 16 }}>
              <div className="vp-linha"><span>Motorista</span><b>{sel.motorista_email}</b></div>
              <div className="vp-linha"><span>Vínculo</span><b>{sel.vinculado ? "conta ativa" : "aguardando cadastro"}</b></div>
              <div className="vp-linha"><span>Último pagamento</span><b>{sel.ultimo_pagamento ?? "—"}</b></div>
            </div>
            <button className="btn primary" onClick={marcarPago}>✓ Registrar pagamento ({brl(sel.valor)})</button>
            <button className="btn ghost block" style={{ marginTop: 10 }} onClick={removerAluguel}>Encerrar aluguel</button>
          </>
        )}
      </Sheet>

      {/* Detalhe do carro */}
      <Sheet open={!!selCarro} title={selCarro?.modelo ?? ""} onClose={() => setSelCarro(null)}>
        {selCarro && (
          <>
            <div className="vp-linhas" style={{ marginBottom: 16 }}>
              <div className="vp-linha"><span>Status</span><b>{selCarro.disponivel ? "Disponível" : `Alugado · ${selCarro.motorista_atual ?? ""}`}</b></div>
              {selCarro.placa && <div className="vp-linha"><span>Placa</span><b>{selCarro.placa}</b></div>}
              {selCarro.ano && <div className="vp-linha"><span>Ano</span><b>{selCarro.ano}</b></div>}
              {selCarro.cor && <div className="vp-linha"><span>Cor</span><b>{selCarro.cor}</b></div>}
              {selCarro.km != null && <div className="vp-linha"><span>KM</span><b>{selCarro.km.toLocaleString("pt-BR")}</b></div>}
              {selCarro.combustivel && <div className="vp-linha"><span>Combustível</span><b>{selCarro.combustivel}</b></div>}
              {selCarro.valor_sugerido != null && <div className="vp-linha"><span>Aluguel sugerido</span><b>{brl(selCarro.valor_sugerido)}</b></div>}
            </div>
            {!selCarro.disponivel ? (
              <div className="hint">Encerre o aluguel deste carro antes de removê-lo.</div>
            ) : (
              <button className="btn ghost block" onClick={removerCarro}>Remover do catálogo</button>
            )}
          </>
        )}
      </Sheet>
    </Page>
  );
}
