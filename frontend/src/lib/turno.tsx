import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import type { Ponto, Turno } from "./types";

export function paraDate(iso: string): Date {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
}

function haversineKm(a: Ponto, b: Ponto): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const round2 = (n: number) => Math.round(n * 100) / 100;

interface TurnoCtx {
  turno: Turno | null;
  loading: boolean;
  rodando: boolean;
  decorridoMs: number;
  pontos: Ponto[];
  kmGps: number;
  gpsErro: string | null;
  iniciar: (data: string) => Promise<void>;
  encerrar: () => Promise<void>;
}

const Ctx = createContext<TurnoCtx>(null!);

export function TurnoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [turno, setTurno] = useState<Turno | null>(null);
  const [loading, setLoading] = useState(true);
  const [agora, setAgora] = useState(Date.now());

  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [kmGps, setKmGps] = useState(0);
  const [gpsErro, setGpsErro] = useState<string | null>(null);

  const pontosRef = useRef<Ponto[]>([]);
  const kmRef = useRef(0);
  const lastPosRef = useRef<Ponto | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);

  // Busca o turno em aberto quando o usuario loga (e limpa ao sair).
  useEffect(() => {
    if (!user) {
      setTurno(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get<Turno | null>("/turnos/atual")
      .then(setTurno)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  // Cronometro: tica de segundo em segundo enquanto ha turno rodando.
  useEffect(() => {
    if (!turno) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [turno]);

  async function pedirWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeRef.current = await (navigator as Navigator).wakeLock.request("screen");
      }
    } catch {
      /* alguns navegadores bloqueiam; segue sem */
    }
  }

  // Rastreamento GPS + Wake Lock enquanto ha turno.
  useEffect(() => {
    if (!turno) return;

    // Inicializa com o que ja estava salvo no servidor.
    const iniciais = (turno.pontos ?? []) as Ponto[];
    pontosRef.current = iniciais;
    kmRef.current = turno.km ?? 0;
    lastPosRef.current = iniciais.length ? iniciais[iniciais.length - 1] : null;
    setPontos(iniciais);
    setKmGps(round2(kmRef.current));
    setGpsErro(null);

    pedirWakeLock();

    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (pos.coords.accuracy && pos.coords.accuracy > 100) return; // muito impreciso
          const p: Ponto = [pos.coords.latitude, pos.coords.longitude];
          const last = lastPosRef.current;
          if (last) {
            const d = haversineKm(last, p);
            if (d < 0.008) return; // parado / ruido (<8m)
            if (d < 1) kmRef.current += d; // salto >1km = erro de GPS, nao soma
          }
          pontosRef.current = [...pontosRef.current, p];
          lastPosRef.current = p;
          setPontos(pontosRef.current);
          setKmGps(round2(kmRef.current));
        },
        (err) => setGpsErro(err.message || "Não foi possível acessar o GPS"),
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 }
      );
    } else {
      setGpsErro("GPS indisponível neste dispositivo");
    }

    // Autosave da rota a cada 20s (durabilidade se fechar o app).
    saveTimerRef.current = setInterval(() => {
      api.patch(`/turnos/${turno.id}`, { km: round2(kmRef.current), pontos: pontosRef.current }).catch(() => {});
    }, 20000);

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      saveTimerRef.current = null;
      wakeRef.current?.release().catch(() => {});
      wakeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno?.id]);

  // Reativa o Wake Lock ao voltar pro app (ele cai quando a tela apaga).
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible" && turno && !wakeRef.current) pedirWakeLock();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [turno]);

  const rodando = !!turno;
  const decorridoMs = turno ? agora - paraDate(turno.inicio).getTime() : 0;

  async function iniciar(data: string) {
    pontosRef.current = [];
    kmRef.current = 0;
    lastPosRef.current = null;
    const t = await api.post<Turno>("/turnos/iniciar", { data });
    setTurno(t);
    setAgora(Date.now());
  }

  async function encerrar() {
    await api.post<Turno>("/turnos/encerrar", { km: round2(kmRef.current), pontos: pontosRef.current });
    setTurno(null);
    pontosRef.current = [];
    kmRef.current = 0;
    lastPosRef.current = null;
    setPontos([]);
    setKmGps(0);
    setGpsErro(null);
  }

  return (
    <Ctx.Provider
      value={{ turno, loading, rodando, decorridoMs, pontos, kmGps, gpsErro, iniciar, encerrar }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useTurno() {
  return useContext(Ctx);
}
