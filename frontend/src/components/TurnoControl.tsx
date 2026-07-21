import { useTurno } from "../lib/turno";
import { hojeISO } from "../lib/format";

function formataDuracao(ms: number): string {
  const s = Math.max(Math.floor(ms / 1000), 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(seg)}`;
}

export default function TurnoControl() {
  const { rodando, decorridoMs, iniciar, encerrar } = useTurno();

  async function alternar() {
    if (rodando) {
      if (!confirm("Encerrar o turno agora?")) return;
      await encerrar();
    } else {
      await iniciar(hojeISO());
    }
  }

  return (
    <div className={`turno ${rodando ? "rodando" : ""}`}>
      {rodando ? <span className="live-dot" /> : <span style={{ fontSize: 20 }}>⏱️</span>}
      <div className="info">
        <div className="st">{rodando ? "Rodando agora" : "Fora de turno"}</div>
        <div className="clock" style={rodando ? undefined : { color: "var(--text-faint)", fontSize: 18 }}>
          {rodando ? formataDuracao(decorridoMs) : "00:00:00"}
        </div>
      </div>
      <button className={`go ${rodando ? "stop" : "start"}`} onClick={alternar}>
        {rodando ? "Encerrar" : "▶ Começar"}
      </button>
    </div>
  );
}
