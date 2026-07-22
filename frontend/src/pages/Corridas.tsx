import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Page from "../components/Page";
import Sheet from "../components/Sheet";
import { api } from "../lib/api";
import { useTurno } from "../lib/turno";
import { brl, hojeISO } from "../lib/format";
import { interpretarCorrida, ouvirCorrida, reconhecimentoDisponivel } from "../lib/voz";
import type { Corrida, ValeAPena } from "../lib/types";

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
  const [ouvindo, setOuvindo] = useState(false);
  const [vozMsg, setVozMsg] = useState<string | null>(null);
  const { rodando, decorridoMs } = useTurno();
  const inputRef = useRef<HTMLInputElement>(null);

  // "Vale a pena?"
  const [vpAberto, setVpAberto] = useState(false);
  const [vpValor, setVpValor] = useState("");
  const [vpKm, setVpKm] = useState("");
  const [vpMin, setVpMin] = useState("");
  const [vpRes, setVpRes] = useState<ValeAPena | null>(null);
  const [vpLoad, setVpLoad] = useState(false);

  useEffect(() => {
    api
      .get<Corrida[]>(`/corridas?data=${hoje}`)
      .then(setLista)
      .finally(() => setCarregando(false));
  }, [hoje]);

  const total = lista.reduce((s, c) => s + c.valor, 0);
  const horasDecorridas = decorridoMs / 3_600_000;
  const porHoraVivo = horasDecorridas > 0.05 ? total / horasDecorridas : 0;

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

  async function falar() {
    if (ouvindo) return;
    setVozMsg(null);
    if (!reconhecimentoDisponivel()) {
      setVozMsg(
        "🎙️ Reconhecimento de voz indisponível aqui. Funciona no navegador Chrome; no APK ele entra numa próxima versão (plugin nativo)."
      );
      return;
    }
    setOuvindo(true);
    try {
      const texto = await ouvirCorrida();
      const r = interpretarCorrida(texto);
      if (r.valor != null) setValor(String(r.valor).replace(".", ","));
      if (r.km != null) setKm(String(r.km).replace(".", ","));
      if (r.plataforma) setPlataforma(r.plataforma);

      const partes: string[] = [];
      if (r.valor != null) partes.push(brl(r.valor));
      if (r.km != null) partes.push(`${r.km} km`);
      if (r.plataforma) partes.push(nomePlat(r.plataforma));

      if (r.valor != null) {
        setVozMsg(`🎙️ Entendi: ${partes.join(" · ")} — confira e toque em +`);
      } else {
        setVozMsg(`🎙️ Ouvi "${texto}", mas não achei o valor. Tente: "corrida de 50 reais e 2 km".`);
      }
    } catch (e) {
      const cod = e instanceof Error ? e.message : "";
      if (cod === "sem-fala") setVozMsg("🎙️ Não ouvi nada. Toque no microfone e fale a corrida.");
      else if (cod === "not-allowed" || cod === "service-not-allowed")
        setVozMsg("🎙️ Permissão de microfone negada. Libere o microfone e tente de novo.");
      else setVozMsg("🎙️ Não consegui reconhecer. Tente de novo.");
    } finally {
      setOuvindo(false);
    }
  }

  async function calcularVale() {
    const v = parseFloat(vpValor.replace(",", "."));
    const k = parseFloat(vpKm.replace(",", "."));
    if (!v || !k || v <= 0 || k <= 0) return;
    setVpLoad(true);
    try {
      const res = await api.post<ValeAPena>("/config/vale-a-pena", {
        valor: v,
        km: k,
        minutos: parseFloat(vpMin.replace(",", ".")) || null,
      });
      setVpRes(res);
    } finally {
      setVpLoad(false);
    }
  }

  function abrirVale() {
    setVpRes(null);
    setVpValor("");
    setVpKm("");
    setVpMin("");
    setVpAberto(true);
  }

  const veredito = {
    otimo: { selo: "🟢", tit: "Vale a pena!" },
    ok: { selo: "🟡", tit: "Dá pra aceitar" },
    prejuizo: { selo: "🔴", tit: "É prejuízo" },
  };

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

      <button className={`voz-btn ${ouvindo ? "on" : ""}`} onClick={falar} disabled={ouvindo}>
        <span className="voz-ico">🎙️</span>
        {ouvindo ? "Ouvindo... fale a corrida" : "Registrar por voz"}
      </button>
      {vozMsg && <div className="voz-msg">{vozMsg}</div>}

      <button className="vp-trigger" onClick={abrirVale}>
        🤔 Vale a pena? — calcule antes de aceitar
      </button>

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

      <Sheet open={vpAberto} title="Vale a pena aceitar?" onClose={() => setVpAberto(false)}>
        <div className="field-row">
          <div className="field">
            <label>Valor oferecido (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={vpValor}
              onChange={(e) => setVpValor(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="0,00"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Distância (km)</label>
            <input
              type="text"
              inputMode="decimal"
              value={vpKm}
              onChange={(e) => setVpKm(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="0"
            />
          </div>
        </div>
        <div className="field">
          <label>Tempo estimado (min) — opcional</label>
          <input
            type="text"
            inputMode="decimal"
            value={vpMin}
            onChange={(e) => setVpMin(e.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder="Ex: 15"
          />
        </div>

        {vpRes && (
          <>
            <div className={`veredito ${vpRes.veredito}`}>
              <div className="selo">{veredito[vpRes.veredito].selo}</div>
              <div className="tit">{veredito[vpRes.veredito].tit}</div>
              <div className="det">
                Lucro estimado <b>{brl(vpRes.lucro_estimado)}</b>
                {vpRes.r_por_hora ? ` · ${brl(vpRes.r_por_hora)}/h` : ""}
              </div>
            </div>
            <div className="vp-linhas">
              <div className="vp-linha">
                <span>Você ganha por km</span>
                <b>{brl(vpRes.valor_por_km)}</b>
              </div>
              <div className="vp-linha">
                <span>Seu custo por km</span>
                <b>{brl(vpRes.custo_por_km)}</b>
              </div>
              <div className="vp-linha">
                <span>Custo total da corrida</span>
                <b>{brl(vpRes.custo_estimado)}</b>
              </div>
            </div>
          </>
        )}

        <button className="btn primary" disabled={vpLoad} style={{ marginTop: 16 }} onClick={calcularVale}>
          {vpLoad ? "Calculando..." : vpRes ? "Calcular de novo" : "Calcular"}
        </button>
      </Sheet>
    </Page>
  );
}
