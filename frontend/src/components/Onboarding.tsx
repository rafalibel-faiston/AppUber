import { useState } from "react";
import { motion } from "framer-motion";

const FLAG = "volante_onboarded";

export function jaFezOnboarding(): boolean {
  return localStorage.getItem(FLAG) === "1";
}

type Estado = "idle" | "ok" | "negado" | "indisponivel";

export default function Onboarding({ onConcluir }: { onConcluir: () => void }) {
  const [loc, setLoc] = useState<Estado>("idle");
  const [notif, setNotif] = useState<Estado>("idle");

  function pedirLocalizacao() {
    if (!("geolocation" in navigator)) {
      setLoc("indisponivel");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLoc("ok"),
      () => setLoc("negado"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function pedirNotificacoes() {
    if (!("Notification" in window)) {
      setNotif("indisponivel");
      return;
    }
    try {
      const r = await Notification.requestPermission();
      setNotif(r === "granted" ? "ok" : "negado");
    } catch {
      setNotif("indisponivel");
    }
  }

  function concluir() {
    localStorage.setItem(FLAG, "1");
    onConcluir();
  }

  const selo = (e: Estado) =>
    e === "ok" ? "✓ Permitido" : e === "negado" ? "Negado" : e === "indisponivel" ? "Indisponível" : "";

  return (
    <motion.div
      className="onb"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="onb-inner">
        <div className="onb-logo">🚗</div>
        <h1 className="onb-titulo">Bem-vindo ao Volante</h1>
        <p className="onb-sub">Pra funcionar melhor, o app precisa de duas permissões. Você decide o que liberar.</p>

        <div className={`onb-card ${loc === "ok" ? "ok" : ""}`}>
          <div className="onb-ic">📍</div>
          <div className="onb-txt">
            <b>Localização</b>
            <small>Pra traçar sua rota no mapa e contar os km automaticamente enquanto você roda.</small>
          </div>
          <button
            className={`btn ${loc === "ok" ? "ghost" : "primary"}`}
            style={{ height: 42, width: "auto", padding: "0 16px", flexShrink: 0 }}
            onClick={pedirLocalizacao}
            disabled={loc === "ok"}
          >
            {loc === "idle" ? "Permitir" : selo(loc)}
          </button>
        </div>

        <div className={`onb-card ${notif === "ok" ? "ok" : ""}`}>
          <div className="onb-ic">🔔</div>
          <div className="onb-txt">
            <b>Notificações</b>
            <small>Pra te avisar de vencimento de contas, progresso das metas e hora de descansar.</small>
          </div>
          <button
            className={`btn ${notif === "ok" ? "ghost" : "primary"}`}
            style={{ height: 42, width: "auto", padding: "0 16px", flexShrink: 0 }}
            onClick={pedirNotificacoes}
            disabled={notif === "ok"}
          >
            {notif === "idle" ? "Permitir" : selo(notif)}
          </button>
        </div>

        <button className="btn primary block" style={{ marginTop: 24 }} onClick={concluir}>
          Começar a usar
        </button>
        <button className="onb-pular" onClick={concluir}>
          Pular por agora
        </button>
      </div>
    </motion.div>
  );
}
