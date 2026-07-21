import { useEffect, useState } from "react";
import Page from "../components/Page";
import Sheet from "../components/Sheet";
import { api } from "../lib/api";
import { brl } from "../lib/format";
import type { Meta } from "../lib/types";

const periodos = [
  { id: "diaria", label: "Diária" },
  { id: "semanal", label: "Semanal" },
  { id: "mensal", label: "Mensal" },
] as const;

export default function Metas() {
  const [lista, setLista] = useState<Meta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<{ periodo: Meta["periodo"]; valor_alvo: string }>({
    periodo: "semanal",
    valor_alvo: "",
  });

  function carregar() {
    api
      .get<Meta[]>("/metas")
      .then(setLista)
      .finally(() => setCarregando(false));
  }
  useEffect(carregar, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post("/metas", { periodo: form.periodo, valor_alvo: parseFloat(form.valor_alvo) || 0, ativo: true });
      setAberto(false);
      setForm({ periodo: "semanal", valor_alvo: "" });
      setCarregando(true);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    if (!confirm("Excluir esta meta?")) return;
    await api.del(`/metas/${id}`);
    setLista((l) => l.filter((m) => m.id !== id));
  }

  const labelP = (p: string) => periodos.find((x) => x.id === p)?.label ?? p;

  return (
    <Page>
      <div className="topbar">
        <div className="name" style={{ fontSize: 24 }}>
          Metas
        </div>
        <button className="btn ghost" style={{ height: 40, padding: "0 16px" }} onClick={() => setAberto(true)}>
          + Nova
        </button>
      </div>

      {carregando ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : lista.length === 0 ? (
        <div className="empty">
          <div className="emoji">🎯</div>
          <p>Nenhuma meta definida.</p>
          <p style={{ marginTop: 6 }}>Defina quanto quer lucrar por dia, semana ou mês.</p>
        </div>
      ) : (
        lista.map((m) => (
          <div className="row" key={m.id} onClick={() => remover(m.id)}>
            <div className="ic">🎯</div>
            <div className="body">
              <div className="t">Meta {labelP(m.periodo).toLowerCase()}</div>
              <div className="s">{m.ativo ? "Ativa" : "Inativa"}</div>
            </div>
            <div className="val">{brl(m.valor_alvo)}</div>
          </div>
        ))
      )}

      <Sheet open={aberto} title="Nova meta" onClose={() => setAberto(false)}>
        <form onSubmit={salvar}>
          <div className="field">
            <label>Período</label>
            <div className="chips">
              {periodos.map((p) => (
                <div
                  key={p.id}
                  className={`chip ${form.periodo === p.id ? "active" : ""}`}
                  onClick={() => setForm({ ...form, periodo: p.id })}
                >
                  {p.label}
                </div>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Valor alvo — lucro líquido (R$)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={form.valor_alvo}
              onChange={(e) => setForm({ ...form, valor_alvo: e.target.value })}
              placeholder="Ex: 1500,00"
              required
            />
            <div className="hint">O progresso aparece no painel conforme você registra jornadas e gastos.</div>
          </div>
          <button className="btn primary" disabled={salvando} style={{ marginTop: 8 }}>
            {salvando ? "Salvando..." : "Salvar meta"}
          </button>
        </form>
      </Sheet>
    </Page>
  );
}
