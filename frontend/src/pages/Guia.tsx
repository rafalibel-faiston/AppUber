import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Page from "../components/Page";
import { useAuth } from "../lib/auth";

type Perfil = "motorista" | "locadora";
interface Topico {
  cat: string;
  ico: string;
  titulo: string;
  resumo: string;
  passos: string[];
}

const MOTORISTA: Topico[] = [
  {
    cat: "Primeiros passos", ico: "🚀", titulo: "Criar conta e entrar",
    resumo: "Cadastro rápido com nome, e-mail e senha.",
    passos: [
      "Na tela inicial, toque em “Cadastre-se”.",
      "Escolha o perfil 🚗 Motorista, preencha nome, e-mail e senha (mín. 6).",
      "Pronto: você já entra direto no Painel. Da próxima vez é só “Entrar”.",
    ],
  },
  {
    cat: "Dia a dia", ico: "⏱️", titulo: "Turno (cronômetro + GPS)",
    resumo: "Marca o tempo real trabalhado e traça sua rota com km automático.",
    passos: [
      "No Painel, toque em “Iniciar” para começar o turno.",
      "O app conta o tempo e, com o GPS ligado, desenha a rota e soma os km sozinho.",
      "Toque em “Ampliar” para ver o mapa em tela cheia.",
      "Ao terminar, toque em “Encerrar” — o tempo entra no cálculo de lucro por hora.",
    ],
  },
  {
    cat: "Dia a dia", ico: "🚕", titulo: "Registrar corridas",
    resumo: "Lance cada corrida em segundos — digitando ou por voz.",
    passos: [
      "Na aba Corridas, escolha a plataforma, digite o valor e toque em +.",
      "Pode informar o km da corrida (opcional) para comparar plataformas.",
      "Por voz: toque em “Registrar por voz” e fale, ex.: “corrida de 50 reais e 2 km na Uber”.",
      "Confira o que o app entendeu e toque em + para salvar.",
    ],
  },
  {
    cat: "Dia a dia", ico: "🤔", titulo: "Vale a pena? (antes de aceitar)",
    resumo: "Calcula o lucro real de uma corrida antes de você aceitar.",
    passos: [
      "Na aba Corridas, toque em “Vale a pena?”.",
      "Informe o valor oferecido, a distância e (opcional) o tempo.",
      "O app mostra 🟢 vale, 🟡 dá pra aceitar ou 🔴 prejuízo, com o lucro por km.",
    ],
  },
  {
    cat: "Dia a dia", ico: "💸", titulo: "Gastos",
    resumo: "Combustível, pedágio, comida, manutenção — tudo que sai do bolso.",
    passos: [
      "Na aba Gastos, escolha a categoria, digite o valor e toque em +.",
      "Os gastos entram automaticamente no cálculo do lucro líquido.",
    ],
  },
  {
    cat: "Seus números", ico: "◎", titulo: "Painel (lucro de verdade)",
    resumo: "Lucro líquido por Hoje/Semana/Mês, por hora e por km.",
    passos: [
      "O grande número é o lucro líquido (ganhos − gastos) do período escolhido.",
      "Troque entre Hoje, Semana e Mês no seletor.",
      "Veja lucro por hora, por km, nº de corridas e o gráfico dos últimos 14 dias.",
      "Um aviso discreto aparece quando algo precisa de atenção (toque no ✕ para dispensar).",
    ],
  },
  {
    cat: "Planejamento", ico: "📅", titulo: "Agenda de trabalho",
    resumo: "Planeje os dias e horas que pretende rodar.",
    passos: [
      "Abra a Agenda pelo atalho no Painel.",
      "Toque num dia para marcar Trabalho (com horas) ou Folga.",
      "Arraste o dedo pelos dias para marcar vários de uma vez.",
      "Use “Preencher o mês” para aplicar um padrão (todos, dias úteis ou fim de semana).",
    ],
  },
  {
    cat: "Planejamento", ico: "🎯", titulo: "Metas",
    resumo: "Defina a meta mensal — o app divide em semana e dia pela sua Agenda.",
    passos: [
      "No menu ☰ do Painel, abra Metas.",
      "Defina a meta mensal de lucro.",
      "O app calcula a meta por dia de trabalho e da semana usando os dias marcados na Agenda.",
      "O progresso aparece no Painel em cada período.",
    ],
  },
  {
    cat: "Aluguel", ico: "🔑", titulo: "Aluguel do carro",
    resumo: "Se você aluga da locadora, vê o valor, o vencimento e pode trocar de carro.",
    passos: [
      "Se a locadora cadastrou um aluguel no seu e-mail, aparece um cartão no Painel.",
      "Toque nele para ver o valor, o vencimento e o status (em dia/atrasado).",
      "Para trocar de carro, escolha um carro livre na lista — a locadora recebe seu pedido.",
    ],
  },
  {
    cat: "Configuração", ico: "⚙️", titulo: "Ajustes (custo do carro)",
    resumo: "Configure o custo por km para o lucro sair certo.",
    passos: [
      "No menu ☰ do Painel, abra Ajustes.",
      "Informe combustível, consumo (km/l), desgaste e custo fixo diário.",
      "O app calcula seu custo real por km — base do “Vale a pena?” e do lucro.",
      "Veja também o comparador de plataformas (quem paga melhor por km).",
    ],
  },
];

const LOCADORA: Topico[] = [
  {
    cat: "Primeiros passos", ico: "🚀", titulo: "Criar conta de locadora",
    resumo: "Um perfil próprio para gerir carros e aluguéis.",
    passos: [
      "Na tela inicial, toque em “Cadastre-se”.",
      "Escolha o perfil 🔑 Locadora e preencha seus dados.",
      "Você entra no Painel da locadora (sem as abas de motorista).",
    ],
  },
  {
    cat: "Frota", ico: "🚗", titulo: "Catálogo de carros",
    resumo: "Cadastre seus carros com todos os detalhes.",
    passos: [
      "Na aba Carros, toque em “+ Adicionar carro”.",
      "Preencha modelo, placa, ano, cor, km, combustível e aluguel sugerido.",
      "Cada carro mostra se está Livre ou Alugado.",
      "Só dá para remover um carro que não esteja alugado.",
    ],
  },
  {
    cat: "Aluguéis", ico: "🔑", titulo: "Criar um aluguel",
    resumo: "Atribua um carro a um motorista pelo e-mail dele.",
    passos: [
      "Na aba Aluguéis, toque em “+ Novo aluguel”.",
      "Informe o e-mail do motorista e escolha um carro livre do catálogo.",
      "Defina o valor e a cobrança (semanal ou mensal) com o dia de vencimento.",
      "O carro escolhido fica “Alugado” automaticamente.",
      "Se o motorista ainda não tem conta, ele é vinculado quando se cadastrar com esse e-mail.",
    ],
  },
  {
    cat: "Aluguéis", ico: "💰", titulo: "Pagamentos e status",
    resumo: "Registre pagamentos e acompanhe quem está em dia.",
    passos: [
      "Toque num aluguel para ver os detalhes.",
      "Use “Registrar pagamento” a cada ciclo pago.",
      "O status vira Em dia, A vencer ou Atrasado conforme o vencimento e o pagamento.",
    ],
  },
  {
    cat: "Aluguéis", ico: "⇄", titulo: "Trocar carro de um motorista",
    resumo: "Aprove (ou recuse) os pedidos de troca dos motoristas.",
    passos: [
      "Quando um motorista pede troca, o aluguel mostra a marca “Troca ⇄”.",
      "Abra o aluguel e veja para qual carro ele quer trocar.",
      "Toque em Aprovar (troca o carro e libera o antigo) ou Recusar.",
    ],
  },
  {
    cat: "Visão geral", ico: "📊", titulo: "Resumo e receita",
    resumo: "Números da operação no topo do painel.",
    passos: [
      "Alugados / frota: quantos carros estão alugados do total.",
      "Receita/mês (est.): soma estimada — aluguéis semanais contam ~4,33 semanas no mês.",
      "A vencer (7d) e Atrasados ajudam a cobrar na hora certa.",
    ],
  },
];

export default function Guia() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [perfil, setPerfil] = useState<Perfil>(user?.papel === "locadora" ? "locadora" : "motorista");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);

  const topicos = perfil === "locadora" ? LOCADORA : MOTORISTA;

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return topicos;
    return topicos.filter((t) =>
      [t.titulo, t.resumo, t.cat, ...t.passos].join(" ").toLowerCase().includes(q)
    );
  }, [topicos, busca]);

  const categorias = useMemo(() => {
    const map = new Map<string, Topico[]>();
    for (const t of filtrados) {
      if (!map.has(t.cat)) map.set(t.cat, []);
      map.get(t.cat)!.push(t);
    }
    return [...map.entries()];
  }, [filtrados]);

  return (
    <Page>
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="icon-btn" onClick={() => navigate("/")} aria-label="Voltar">‹</button>
          <div>
            <div className="hello">Guia do app</div>
            <div className="name" style={{ fontSize: 22 }}>Ajuda</div>
          </div>
        </div>
      </div>

      <div className="segment" style={{ marginBottom: 14 }}>
        <button className={perfil === "motorista" ? "active" : ""} onClick={() => setPerfil("motorista")}>🚗 Motorista</button>
        <button className={perfil === "locadora" ? "active" : ""} onClick={() => setPerfil("locadora")}>🔑 Locadora</button>
      </div>

      <div className="guia-busca">
        <span>🔍</span>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no guia..." />
        {busca && <button onClick={() => setBusca("")} aria-label="Limpar">✕</button>}
      </div>

      {categorias.length === 0 ? (
        <div className="empty"><div className="emoji">🔍</div><p>Nada encontrado para “{busca}”.</p></div>
      ) : (
        categorias.map(([cat, items]) => (
          <div key={cat}>
            <div className="section-title"><h3>{cat}</h3></div>
            {items.map((t) => {
              const on = aberto === t.titulo;
              return (
                <div key={t.titulo} className={`guia-item ${on ? "on" : ""}`}>
                  <button className="gi-head" onClick={() => setAberto(on ? null : t.titulo)}>
                    <span className="gi-ico">{t.ico}</span>
                    <span className="gi-txt">
                      <span className="gi-tit">{t.titulo}</span>
                      <span className="gi-res">{t.resumo}</span>
                    </span>
                    <span className={`gi-chev ${on ? "on" : ""}`}>⌄</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.ol
                        className="gi-passos"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {t.passos.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </motion.ol>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ))
      )}

      <div className="km-opt" style={{ justifyContent: "center", marginTop: 24 }}>
        <span>Volante · seu turno, seus números, seu lucro de verdade</span>
      </div>
    </Page>
  );
}
