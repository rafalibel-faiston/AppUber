import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Page from "../components/Page";
import { api } from "../lib/api";
import { brl, dataCurta, hojeISO } from "../lib/format";
import type { Gasto } from "../lib/types";

const categorias = [
  { id: "combustivel", label: "Combustível", ico: "⛽" },
  { id: "alimentacao", label: "Comida", ico: "🍔" },
  { id: "pedagio", label: "Pedágio", ico: "🛣️" },
  { id: "lavagem", label: "Lavagem", ico: "🧼" },
  { id: "manutencao", label: "Manutenção", ico: "🔧" },
  { id: "aluguel", label: "Aluguel", ico: "🔑" },
  { id: "outro", label: "Outro", ico: "📦" },
];
const icoDe = (id: string) => categorias.find((c) => c.id === id)?.ico ?? "📦";
const labelDe = (id: string) => categorias.find((c) => c.id === id)?.label ?? id;

export default function Gastos() {
  const [lista, setLista] = useState<Gasto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [categoria, setCategoria] = useState("combustivel");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function carregar() {
    api
      .get<Gasto[]>("/gastos")
      .then(setLista)
      .finally(() => setCarregando(false));
  }
  useEffect(carregar, []);

  const total = lista.reduce((s, g) => s + g.valor, 0);

  async function adicionar() {
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0 || salvando) return;
    setSalvando(true);
    try {
      const novo = await api.post<Gasto>("/gastos", {
        categoria,
        valor: v,
        data: hojeISO(),
        descricao: descricao || null,
      });
      setLista((l) => [novo, ...l]);
      setValor("");
      setDescricao("");
      inputRef.current?.focus();
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    await api.del(`/gastos/${id}`);
    setLista((l) => l.filter((g) => g.id !== id));
  }

  return (
    <Page>
      <div className="topbar">
        <div>
          <div className="hello">Controle</div>
          <div className="name" style={{ fontSize: 22 }}>
            Gastos
          </div>
        </div>
      </div>

      <div className="hero" style={{ marginBottom: 20 }}>
        <div className="label">Total em gastos</div>
        <motion.div
          key={total}
          className="big neg"
          initial={{ scale: 1.06, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          {brl(total)}
        </motion.div>
        <div className="sub">
          {lista.length} {lista.length === 1 ? "lançamento" : "lançamentos"}
        </div>
      </div>

      {/* Categoria */}
      <div className="chips" style={{ marginBottom: 14 }}>
        {categorias.map((c) => (
          <div
            key={c.id}
            className={`chip ${categoria === c.id ? "active" : ""}`}
            onClick={() => setCategoria(c.id)}
          >
            {c.ico} {c.label}
          </div>
        ))}
      </div>

      {/* Valor + adicionar */}
      <div className="valor-box">
        <span className="cifrao">R$</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          placeholder="0,00"
        />
        <button className="add-btn" onClick={adicionar} disabled={salvando || !valor}>
          +
        </button>
      </div>
      <div className="km-opt">
        <input
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="anotação"
          style={{ width: "100%" }}
        />
      </div>

      <div className="section-title">
        <h3>Lançamentos</h3>
      </div>

      {carregando ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : lista.length === 0 ? (
        <div className="empty">
          <div className="emoji">💸</div>
          <p>Nenhum gasto ainda.</p>
          <p style={{ marginTop: 6 }}>Escolha a categoria, digite o valor e toque em +.</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {lista.map((g) => (
            <motion.div
              key={g.id}
              className="row"
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              onClick={() => remover(g.id)}
            >
              <div className="ic">{icoDe(g.categoria)}</div>
              <div className="body">
                <div className="t">{labelDe(g.categoria)}</div>
                <div className="s">
                  {dataCurta(g.data)}
                  {g.descricao ? ` · ${g.descricao}` : ""}
                </div>
              </div>
              <div className="val neg">-{brl(g.valor)}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </Page>
  );
}
