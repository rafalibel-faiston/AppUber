import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Page from "../components/Page";
import Sheet from "../components/Sheet";
import { api } from "../lib/api";
import { brl } from "../lib/format";
import type { Conta, ContasResumo } from "../lib/types";

const categorias = [
  { id: "financiamento", label: "Financiamento", ico: "🚗" },
  { id: "aluguel", label: "Aluguel", ico: "🔑" },
  { id: "seguro", label: "Seguro", ico: "🛡️" },
  { id: "cartao", label: "Cartão", ico: "💳" },
  { id: "ipva", label: "IPVA/Licenc.", ico: "📋" },
  { id: "outro", label: "Outro", ico: "📦" },
];
const icoDe = (id: string) => categorias.find((c) => c.id === id)?.ico ?? "📦";

export default function Contas() {
  const [lista, setLista] = useState<Conta[]>([]);
  const [resumo, setResumo] = useState<ContasResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    categoria: "financiamento",
    descricao: "",
    valor_parcela: "",
    total_parcelas: "",
    parcelas_pagas: "",
    dia_vencimento: "",
  });

  function carregar() {
    Promise.all([api.get<Conta[]>("/contas"), api.get<ContasResumo>("/contas/resumo")])
      .then(([l, r]) => {
        setLista(l);
        setResumo(r);
      })
      .finally(() => setCarregando(false));
  }
  useEffect(carregar, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post("/contas", {
        categoria: form.categoria,
        descricao: form.descricao,
        valor_parcela: parseFloat(form.valor_parcela.replace(",", ".")) || 0,
        total_parcelas: form.total_parcelas ? parseInt(form.total_parcelas) : null,
        parcelas_pagas: form.parcelas_pagas ? parseInt(form.parcelas_pagas) : 0,
        dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
        ativo: true,
      });
      setAberto(false);
      setForm({ categoria: "financiamento", descricao: "", valor_parcela: "", total_parcelas: "", parcelas_pagas: "", dia_vencimento: "" });
      setCarregando(true);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function pagar(id: string) {
    const atual = await api.post<Conta>(`/contas/${id}/pagar`, {});
    setLista((l) => l.map((c) => (c.id === atual.id ? atual : c)));
    api.get<ContasResumo>("/contas/resumo").then(setResumo);
  }

  async function remover(id: string) {
    if (!confirm("Excluir esta conta?")) return;
    await api.del(`/contas/${id}`);
    setLista((l) => l.filter((c) => c.id !== id));
    api.get<ContasResumo>("/contas/resumo").then(setResumo);
  }

  return (
    <Page>
      <div className="topbar">
        <div>
          <div className="hello">Compromissos</div>
          <div className="name" style={{ fontSize: 22 }}>
            Contas
          </div>
        </div>
        <button className="btn ghost" style={{ height: 40, padding: "0 16px" }} onClick={() => setAberto(true)}>
          + Nova
        </button>
      </div>

      {resumo && resumo.num_ativas > 0 && (
        <div className="hero" style={{ marginBottom: 20 }}>
          <div className="label">Suas contas do mês</div>
          <div className="big neg">{brl(resumo.total_mensal)}</div>
          <div className="sub">
            {resumo.total_restante > 0 && <>faltam {brl(resumo.total_restante)} pra quitar · </>}
            {resumo.num_ativas} {resumo.num_ativas === 1 ? "conta ativa" : "contas ativas"}
          </div>
        </div>
      )}

      <div className="section-title">
        <h3>Minhas contas</h3>
      </div>

      {carregando ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : lista.length === 0 ? (
        <div className="empty">
          <div className="emoji">🚗</div>
          <p>Nenhuma conta cadastrada.</p>
          <p style={{ marginTop: 6 }}>Financiamento do carro, aluguel, seguro... toque em “+ Nova”.</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {lista.map((c) => {
            const prog = c.total_parcelas ? c.parcelas_pagas / c.total_parcelas : 0;
            return (
              <motion.div
                key={c.id}
                className="card"
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0, padding: 0 }}
                style={{ marginBottom: 12 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="ic">{icoDe(c.categoria)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{c.descricao}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {c.total_parcelas
                        ? `parcela ${c.parcelas_pagas}/${c.total_parcelas}`
                        : "recorrente"}
                      {c.dia_vencimento ? ` · vence dia ${c.dia_vencimento}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="num" style={{ fontWeight: 600, fontFamily: "var(--font-display)" }}>
                      {brl(c.valor_parcela)}
                    </div>
                    {c.valor_restante != null && (
                      <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                        resta {brl(c.valor_restante)}
                      </div>
                    )}
                  </div>
                </div>

                {c.total_parcelas && (
                  <div className="meta-bar" style={{ marginTop: 12 }}>
                    <span style={{ width: `${Math.min(prog * 100, 100)}%` }} />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {!c.quitada ? (
                    <button className="btn ghost" style={{ flex: 1, height: 42 }} onClick={() => pagar(c.id)}>
                      ✓ Paguei uma parcela
                    </button>
                  ) : (
                    <div className="btn ghost" style={{ flex: 1, height: 42, color: "var(--accent)" }}>
                      🎉 Quitado!
                    </div>
                  )}
                  <button
                    className="btn ghost"
                    style={{ width: 48, height: 42, color: "var(--neg)" }}
                    onClick={() => remover(c.id)}
                  >
                    🗑
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}

      <Sheet open={aberto} title="Nova conta" onClose={() => setAberto(false)}>
        <form onSubmit={salvar}>
          <div className="field">
            <label>Tipo</label>
            <div className="chips">
              {categorias.map((c) => (
                <div
                  key={c.id}
                  className={`chip ${form.categoria === c.id ? "active" : ""}`}
                  onClick={() => setForm({ ...form, categoria: c.id })}
                >
                  {c.ico} {c.label}
                </div>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Descrição</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex: Financiamento Onix"
              required
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Valor da parcela (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.valor_parcela}
                onChange={(e) => setForm({ ...form, valor_parcela: e.target.value.replace(/[^0-9.,]/g, "") })}
                placeholder="0,00"
                required
              />
            </div>
            <div className="field">
              <label>Dia do vencimento</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.dia_vencimento}
                onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="Ex: 10"
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Total de parcelas</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.total_parcelas}
                onChange={(e) => setForm({ ...form, total_parcelas: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="Ex: 48"
              />
            </div>
            <div className="field">
              <label>Já pagas</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.parcelas_pagas}
                onChange={(e) => setForm({ ...form, parcelas_pagas: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="Ex: 10"
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 8 }}>
            <div className="hint">Deixe “total de parcelas” vazio para contas recorrentes sem fim (aluguel, seguro mensal).</div>
          </div>
          <button className="btn primary" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar conta"}
          </button>
        </form>
      </Sheet>
    </Page>
  );
}
