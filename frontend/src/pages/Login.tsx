import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export default function Login() {
  const { login, register } = useAuth();
  const [modo, setModo] = useState<"login" | "cadastro">("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<"motorista" | "locadora">("motorista");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      if (modo === "login") await login(email, senha);
      else await register(nome, email, senha, papel);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível conectar");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <motion.div className="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="brand">
        Vol<span>ante</span>
      </div>
      <p className="tag">Seu turno, seus números, seu lucro de verdade.</p>

      {erro && <div className="error-msg">{erro}</div>}

      <form onSubmit={submit}>
        {modo === "cadastro" && (
          <>
            <div className="field">
              <label>Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como te chamam" required />
            </div>
            <div className="field">
              <label>Você é</label>
              <div className="papel-row">
                <button
                  type="button"
                  className={`papel ${papel === "motorista" ? "active" : ""}`}
                  onClick={() => setPapel("motorista")}
                >
                  🚗 Motorista
                </button>
                <button
                  type="button"
                  className={`papel ${papel === "locadora" ? "active" : ""}`}
                  onClick={() => setPapel("locadora")}
                >
                  🔑 Locadora
                </button>
              </div>
            </div>
          </>
        )}
        <div className="field">
          <label>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="field">
          <label>Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="mínimo 6 caracteres"
            autoComplete={modo === "login" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
        </div>

        <button className="btn primary" disabled={carregando}>
          {carregando ? "..." : modo === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <div className="switch" onClick={() => setModo(modo === "login" ? "cadastro" : "login")}>
        {modo === "login" ? (
          <>
            Ainda não tem conta? <b>Cadastre-se</b>
          </>
        ) : (
          <>
            Já tem conta? <b>Entrar</b>
          </>
        )}
      </div>
    </motion.div>
  );
}
