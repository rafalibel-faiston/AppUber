import { useEffect, useState } from "react";
import Page from "../components/Page";
import Sheet from "../components/Sheet";
import { api } from "../lib/api";
import { brl, dataCurta, hojeISO } from "../lib/format";
import type { Gasto } from "../lib/types";

const categorias = [
  { id: "combustivel", label: "Combustível", ico: "⛽" },
  { id: "alimentacao", label: "Alimentação", ico: "🍔" },
  { id: "pedagio", label: "Pedágio", ico: "🛣️" },
  { id: "lavagem", label: "Lavagem", ico: "🧼" },
  { id: "manutencao", label: "Manutenção", ico: "🔧" },
  { id: "aluguel", label: "Aluguel carro", ico: "🔑" },
  { id: "outro", label: "Outro", ico: "📦" },
];
const icoDe = (id: string) => categorias.find((c) => c.id === id)?.ico ?? "📦";
const labelDe = (id: string) => categorias.find((c) => c.id === id)?.label ?? id;

export default function Gastos() {
  const [lista, setLista] = useState<Gasto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ categoria: "combustivel", valor: "", data: hojeISO(), descricao: "" });

  function carregar() {
    api
      .get<Gasto[]>("/gastos")
      .then(setLista)
      .finally(() => setCarregando(false));
  }
  useEffect(carregar, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post("/gastos", {
        categoria: form.categoria,
        valor: parseFloat(form.valor) || 0,
        data: form.data,
        descricao: form.descricao || null,
      });
      setAberto(false);
      setForm({ ...form, valor: "", descricao: "" });
      setCarregando(true);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    if (!confirm("Excluir este gasto?")) return;
    await api.del(`/gastos/${id}`);
    setLista((l) => l.filter((g) => g.id !== id));
  }

  const total = lista.reduce((s, g) => s + g.valor, 0);

  return (
    <Page>
      <div className="topbar">
        <div className="name" style={{ fontSize: 24 }}>
          Gastos
        </div>
        <button className="btn ghost" style={{ height: 40, padding: "0 16px" }} onClick={() => setAberto(true)}>
          + Novo
        </button>
      </div>

      {lista.length > 0 && (
        <div className="hero" style={{ marginBottom: 18 }}>
          <div className="label">Total registrado</div>
          <div className="big neg">{brl(total)}</div>
        </div>
      )}

      {carregando ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : lista.length === 0 ? (
        <div className="empty">
          <div className="emoji">💸</div>
          <p>Nenhum gasto lançado.</p>
          <p style={{ marginTop: 6 }}>Combustível, comida, pedágio... registre pra saber seu lucro real.</p>
        </div>
      ) : (
        lista.map((g) => (
          <div className="row" key={g.id} onClick={() => remover(g.id)}>
            <div className="ic">{icoDe(g.categoria)}</div>
            <div className="body">
              <div className="t">{labelDe(g.categoria)}</div>
              <div className="s">
                {dataCurta(g.data)}
                {g.descricao ? ` · ${g.descricao}` : ""}
              </div>
            </div>
            <div className="val neg">-{brl(g.valor)}</div>
          </div>
        ))
      )}

      <Sheet open={aberto} title="Novo gasto" onClose={() => setAberto(false)}>
        <form onSubmit={salvar}>
          <div className="field">
            <label>Categoria</label>
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
          <div className="field-row">
            <div className="field">
              <label>Valor (R$)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
            <div className="field">
              <label>Data</label>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
            </div>
          </div>
          <div className="field">
            <label>Descrição (opcional)</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex: posto Shell, gasolina"
            />
          </div>
          <button className="btn primary" disabled={salvando} style={{ marginTop: 8 }}>
            {salvando ? "Salvando..." : "Salvar gasto"}
          </button>
        </form>
      </Sheet>
    </Page>
  );
}
