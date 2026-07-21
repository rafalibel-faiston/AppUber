import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import type { Turno } from "./types";

export function paraDate(iso: string): Date {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
}

interface TurnoCtx {
  turno: Turno | null;
  loading: boolean;
  rodando: boolean;
  decorridoMs: number;
  iniciar: (data: string) => Promise<void>;
  encerrar: () => Promise<void>;
}

const Ctx = createContext<TurnoCtx>(null!);

export function TurnoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [turno, setTurno] = useState<Turno | null>(null);
  const [loading, setLoading] = useState(true);
  const [agora, setAgora] = useState(Date.now());

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

  const rodando = !!turno;
  const decorridoMs = turno ? agora - paraDate(turno.inicio).getTime() : 0;

  async function iniciar(data: string) {
    const t = await api.post<Turno>("/turnos/iniciar", { data });
    setTurno(t);
    setAgora(Date.now());
  }
  async function encerrar() {
    await api.post<Turno>("/turnos/encerrar", {});
    setTurno(null);
  }

  return (
    <Ctx.Provider value={{ turno, loading, rodando, decorridoMs, iniciar, encerrar }}>{children}</Ctx.Provider>
  );
}

export function useTurno() {
  return useContext(Ctx);
}
