import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Page from "../components/Page";
import { api } from "../lib/api";
import { brl, hojeISO } from "../lib/format";
import type { DashboardResumo, Meta } from "../lib/types";

const periodos = [
  { id: "diaria", label: "Diária" },
  { id: "semanal", label: "Semanal" },
  { id: "mensal", label: "Mensal" },
] as const;
type PeriodoId = (typeof periodos)[number]["id"];

const labelP = (p: string) => periodos.find((x) => x.id === p)?.label ?? p;

export default function Metas() {
  const [lista, setLista] = useState<Meta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoId>("mensal");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [derivada, setDerivada] = useState<{ diaria: number | null; semanal: number | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function carregar() {
    api
      .get<Meta[]>("/metas")
      .then(setLista)
      .finally(() => setCarregando(false));
  }
  useEffect(carregar, []);

  const temMensal = lista.some((m) => m.periodo === "mensal");

  // Quando ha meta mensal, mostra as metas de dia/semana que o app calcula
  // pelos dias marcados na Agenda.
  useEffect(() => {
    if (!temMensal) { setDerivada(null); return; }
    const h = hojeISO();
    Promise.all([
      api.get<DashboardResumo>(`/dashboard/resumo?periodo=diaria&hoje=${h}`),
      api.get<DashboardResumo>(`/dashboard/resumo?periodo=semanal&hoje=${h}`),
    ])
      .then(([d, s]) => setDerivada({ diaria: d.meta_valor, semanal: s.meta_valor }))
      .catch(() => setDerivada(null));
  }, [temMensal, lista]);

  async function adicionar() {
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0 || salvando) return;
    setSalvando(true);
    try {
      // Se ja existe meta desse periodo, atualiza; senao cria.
      const existente = lista.find((m) => m.periodo === periodo);
      if (existente) {
        const atual = await api.patch<Meta>(`/metas/${existente.id}`, { valor_alvo: v, ativo: true });
        setLista((l) => l.map((m) => (m.id === atual.id ? atual : m)));
      } else {
        const nova = await api.post<Meta>("/metas", { periodo, valor_alvo: v, ativo: true });
        setLista((l) => [nova, ...l]);
      }
      setValor("");
      inputRef.current?.focus();
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    await api.del(`/metas/${id}`);
    setLista((l) => l.filter((m) => m.id !== id));
  }

  const jaTem = lista.find((m) => m.periodo === periodo);

  return (
    <Page>
      <div className="topbar">
        <div>
          <div className="hello">Seus objetivos</div>
          <div className="name" style={{ fontSize: 22 }}>
            Metas
          </div>
        </div>
      </div>

      {/* Período */}
      <div className="plat-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {periodos.map((p) => (
          <button
            key={p.id}
            className={`plat ${periodo === p.id ? "active" : ""}`}
            onClick={() => setPeriodo(p.id)}
          >
            <div className="plat-inner">{p.label}</div>
          </button>
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
          placeholder={jaTem ? brl(jaTem.valor_alvo).replace("R$", "").trim() : "0,00"}
        />
        <button className="add-btn" onClick={adicionar} disabled={salvando || !valor}>
          ✓
        </button>
      </div>
      <div className="km-opt">
        <span>
          {periodo === "mensal"
            ? "Defina a mensal — o app divide em semana e dia pelos dias que você marcar na Agenda"
            : `Meta de lucro líquido ${labelP(periodo).toLowerCase()} — o progresso aparece no Painel`}
        </span>
      </div>

      {temMensal && derivada && (derivada.diaria || derivada.semanal) && (
        <div className="derivada">
          <div className="dv-tit">📅 Calculado pela sua Agenda</div>
          <div className="dv-grid">
            <div className="dv-item">
              <span className="dv-k">Por dia de trabalho</span>
              <span className="dv-v">{derivada.diaria ? brl(derivada.diaria) : "—"}</span>
            </div>
            <div className="dv-item">
              <span className="dv-k">Nesta semana</span>
              <span className="dv-v">{derivada.semanal ? brl(derivada.semanal) : "—"}</span>
            </div>
          </div>
          <div className="dv-hint">
            Marque seus dias de trabalho na Agenda pra afinar esses valores.
          </div>
        </div>
      )}

      <div className="section-title">
        <h3>Minhas metas</h3>
      </div>

      {carregando ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : lista.length === 0 ? (
        <div className="empty">
          <div className="emoji">🎯</div>
          <p>Nenhuma meta ainda.</p>
          <p style={{ marginTop: 6 }}>Escolha o período, digite o valor e toque em ✓.</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {lista.map((m) => (
            <motion.div
              key={m.id}
              className="row"
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              onClick={() => remover(m.id)}
            >
              <div className="ic">🎯</div>
              <div className="body">
                <div className="t">Meta {labelP(m.periodo).toLowerCase()}</div>
                <div className="s">toque para remover</div>
              </div>
              <div className="val">{brl(m.valor_alvo)}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </Page>
  );
}
