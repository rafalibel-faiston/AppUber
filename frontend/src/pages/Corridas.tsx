import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Page from "../components/Page";
import { api } from "../lib/api";
import { brl, hojeISO } from "../lib/format";
import type { Corrida, Turno } from "../lib/types";

function paraDate(iso: string): Date {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
}
function formataDuracao(ms: number): string {
  const s = Math.max(Math.floor(ms / 1000), 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(seg)}`;
}

const plataformas = [
  { id: "uber", label: "Uber" },
  { id: "99", label: "99" },
  { id: "indrive", label: "inDrive" },
  { id: "outra", label: "Outra" },
];
const nomePlat = (id: string) => plataformas.find((p) => p.id === id)?.label ?? id;

function horaDe(iso: string): string {
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function Corridas() {
  const hoje = hojeISO();
  const [lista, setLista] = useState<Corrida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [plataforma, setPlataforma] = useState("uber");
  const [valor, setValor] = useState("");
  const [km, setKm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<Corrida[]>(`/corridas?data=${hoje}`)
      .then(setLista)
      .finally(() => setCarregando(false));
    api.get<Turno | null>("/turnos/atual").then(setTurno).catch(() => {});
  }, [hoje]);

  // Tique do cronometro (so quando ha turno rodando)
  useEffect(() => {
    if (!turno) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [turno]);

  const total = lista.reduce((s, c) => s + c.valor, 0);
  const rodando = !!turno;
  const decorridoMs = turno ? agora - paraDate(turno.inicio).getTime() : 0;
  const horasDecorridas = decorridoMs / 3_600_000;
  const porHoraVivo = horasDecorridas > 0.05 ? total / horasDecorridas : 0;

  async function alternarTurno() {
    if (rodando) {
      if (!confirm("Encerrar o turno agora?")) return;
      await api.post<Turno>("/turnos/encerrar", {});
      setTurno(null);
    } else {
      const t = await api.post<Turno>("/turnos/iniciar", { data: hoje });
      setTurno(t);
      setAgora(Date.now());
    }
  }

  async function adicionar() {
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0 || salvando) return;
    setSalvando(true);
    try {
      const nova = await api.post<Corrida>("/corridas", {
        valor: v,
        plataforma,
        km: parseFloat(km.replace(",", ".")) || 0,
        data: hoje,
      });
      setLista((l) => [nova, ...l]);
      setValor("");
      setKm("");
      inputRef.current?.focus();
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    await api.del(`/corridas/${id}`);
    setLista((l) => l.filter((c) => c.id !== id));
  }

  return (
    <Page>
      <div className="topbar">
        <div>
          <div className="hello">Hoje</div>
          <div className="name" style={{ fontSize: 22 }}>
            Corridas
          </div>
        </div>
      </div>

      {/* Cronometro de turno */}
      <div className={`turno ${rodando ? "rodando" : ""}`}>
        {rodando ? <span className="live-dot" /> : <span style={{ fontSize: 20 }}>⏱️</span>}
        <div className="info">
          <div className="st">{rodando ? "Rodando agora" : "Fora de turno"}</div>
          {rodando ? (
            <div className="clock">{formataDuracao(decorridoMs)}</div>
          ) : (
            <div className="clock" style={{ color: "var(--text-faint)", fontSize: 18 }}>
              00:00:00
            </div>
          )}
        </div>
        <button className={`go ${rodando ? "stop" : "start"}`} onClick={alternarTurno}>
          {rodando ? "Encerrar" : "▶ Começar"}
        </button>
      </div>

      {/* Saldo do dia */}
      <div className="hero" style={{ marginBottom: 20 }}>
        <div className="label">Saldo de hoje</div>
        <motion.div
          key={total}
          className="big pos"
          initial={{ scale: 1.08, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          {brl(total)}
        </motion.div>
        <div className="sub">
          {lista.length} {lista.length === 1 ? "corrida" : "corridas"}
          {rodando && porHoraVivo > 0 && (
            <>
              {" "}
              ·&nbsp;<b style={{ color: "var(--pos)" }}>{brl(porHoraVivo)}/h</b> ao vivo
            </>
          )}
        </div>
      </div>

      {/* Seletor de plataforma */}
      <div className="plat-row">
        {plataformas.map((p) => (
          <button
            key={p.id}
            className={`plat ${plataforma === p.id ? "active" : ""}`}
            onClick={() => setPlataforma(p.id)}
          >
            <div className="plat-inner">
              <span className="dot" />
              {p.label}
            </div>
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
          placeholder="0,00"
          autoFocus
        />
        <button className="add-btn" onClick={adicionar} disabled={salvando || !valor}>
          +
        </button>
      </div>
      <div className="km-opt">
        <input
          type="text"
          inputMode="decimal"
          value={km}
          onChange={(e) => setKm(e.target.value.replace(/[^0-9.,]/g, ""))}
          placeholder="km"
        />
        <span>km da corrida (opcional)</span>
      </div>

      {/* Lista do dia */}
      <div className="section-title">
        <h3>Corridas de hoje</h3>
      </div>

      {carregando ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : lista.length === 0 ? (
        <div className="empty">
          <div className="emoji">🚕</div>
          <p>Nenhuma corrida ainda.</p>
          <p style={{ marginTop: 6 }}>Digite o valor da corrida e toque em +.</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {lista.map((c) => (
            <motion.div
              key={c.id}
              className="row"
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              onClick={() => remover(c.id)}
            >
              <div className="ic">🚗</div>
              <div className="body">
                <div className="t">{nomePlat(c.plataforma)}</div>
                <div className="s">
                  {horaDe(c.criado_em)}
                  {c.km ? ` · ${c.km} km` : ""}
                </div>
              </div>
              <div className="val pos">{brl(c.valor)}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </Page>
  );
}
