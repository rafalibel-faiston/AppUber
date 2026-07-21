import { useEffect, useState } from "react";
import Page from "../components/Page";
import Sheet from "../components/Sheet";
import { api } from "../lib/api";
import { brl, dataCurta, diaSemana, hojeISO } from "../lib/format";
import type { Jornada } from "../lib/types";

const plataformas = ["uber", "99", "indrive", "mista"];

export default function Jornadas() {
  const [lista, setLista] = useState<Jornada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    data: hojeISO(),
    inicio: "",
    fim: "",
    km_rodado: "",
    ganho_bruto: "",
    num_corridas: "",
    plataforma: "uber",
  });

  function carregar() {
    api
      .get<Jornada[]>("/jornadas")
      .then(setLista)
      .finally(() => setCarregando(false));
  }
  useEffect(carregar, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post("/jornadas", {
        data: form.data,
        inicio: form.inicio || null,
        fim: form.fim || null,
        km_rodado: parseFloat(form.km_rodado) || 0,
        ganho_bruto: parseFloat(form.ganho_bruto) || 0,
        num_corridas: parseInt(form.num_corridas) || 0,
        plataforma: form.plataforma,
      });
      setAberto(false);
      setForm({ ...form, inicio: "", fim: "", km_rodado: "", ganho_bruto: "", num_corridas: "" });
      setCarregando(true);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    if (!confirm("Excluir esta jornada?")) return;
    await api.del(`/jornadas/${id}`);
    setLista((l) => l.filter((j) => j.id !== id));
  }

  return (
    <Page>
      <div className="topbar">
        <div className="name" style={{ fontSize: 24 }}>
          Jornadas
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
          <div className="emoji">🏁</div>
          <p>Nenhuma jornada registrada ainda.</p>
          <p style={{ marginTop: 6 }}>Toque em “+ Nova” pra lançar seu primeiro dia.</p>
        </div>
      ) : (
        lista.map((j) => (
          <div className="row" key={j.id} onClick={() => remover(j.id)}>
            <div className="ic">🚗</div>
            <div className="body">
              <div className="t">
                {dataCurta(j.data)} · <span style={{ textTransform: "capitalize" }}>{diaSemana(j.data)}</span>
              </div>
              <div className="s">
                {j.num_corridas} corridas · {j.km_rodado} km
                {j.horas_trabalhadas ? ` · ${j.horas_trabalhadas}h` : ""}
                {j.plataforma ? ` · ${j.plataforma}` : ""}
              </div>
            </div>
            <div className="val pos">{brl(j.ganho_bruto)}</div>
          </div>
        ))
      )}

      <Sheet open={aberto} title="Nova jornada" onClose={() => setAberto(false)}>
        <form onSubmit={salvar}>
          <div className="field">
            <label>Data</label>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Início</label>
              <input type="time" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
            </div>
            <div className="field">
              <label>Fim</label>
              <input type="time" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Ganho bruto (R$)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.ganho_bruto}
                onChange={(e) => setForm({ ...form, ganho_bruto: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
            <div className="field">
              <label>Km rodados</label>
              <input
                type="number"
                inputMode="decimal"
                value={form.km_rodado}
                onChange={(e) => setForm({ ...form, km_rodado: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
          <div className="field">
            <label>Nº de corridas</label>
            <input
              type="number"
              inputMode="numeric"
              value={form.num_corridas}
              onChange={(e) => setForm({ ...form, num_corridas: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="field">
            <label>Plataforma</label>
            <div className="chips">
              {plataformas.map((p) => (
                <div
                  key={p}
                  className={`chip ${form.plataforma === p ? "active" : ""}`}
                  onClick={() => setForm({ ...form, plataforma: p })}
                >
                  {p}
                </div>
              ))}
            </div>
          </div>
          <button className="btn primary" disabled={salvando} style={{ marginTop: 8 }}>
            {salvando ? "Salvando..." : "Salvar jornada"}
          </button>
        </form>
      </Sheet>
    </Page>
  );
}
