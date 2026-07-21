# 🚗 Volante — Gestão do Motorista de App

App **mobile-first (PWA)** para motorista de aplicativo controlar tudo do seu trabalho:
corridas, ganhos, gastos, tempo, metas e o **lucro líquido de verdade** (por hora e por km).

- **Frontend:** React + Vite + TypeScript + framer-motion (PWA instalável)
- **Backend:** FastAPI + SQLAlchemy + PostgreSQL
- **Deploy:** um único serviço no Railway (a API serve a API **e** o app buildado)

> É um PWA: pra testar em qualquer celular, basta **abrir o link no navegador** e
> "adicionar à tela inicial". Sem loja, sem build, sem cabo.

---

## 📦 Estrutura

```
AppUber/
├── backend/            # FastAPI
│   └── app/
│       ├── main.py        # entrypoint (API + serve o front em prod)
│       ├── models.py      # tabelas (Usuario, Jornada, Gasto, Meta)
│       ├── schemas.py     # validação Pydantic
│       ├── security.py    # hash de senha + JWT
│       ├── routers/       # auth, jornadas, gastos, metas, dashboard
│       └── utils.py       # cálculos (horas, períodos)
├── frontend/           # React + Vite (PWA)
│   └── src/
│       ├── pages/         # Login, Dashboard, Jornadas, Gastos, Metas
│       ├── components/    # TabBar, Sheet, Page
│       └── lib/           # api, auth, tipos, formatação
├── Dockerfile          # build multi-stage (node → python)
└── railway.json        # config de deploy
```

---

## 💻 Rodar localmente (desenvolvimento)

Você precisa de **2 terminais**: um pro backend, outro pro frontend.

### 1) Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # ajuste se quiser
uvicorn app.main:app --reload --port 8000
```

- API em `http://localhost:8000`
- Docs interativas em `http://localhost:8000/docs`
- Em dev usa **SQLite** (`volante.db`) automaticamente — não precisa instalar Postgres.

### 2) Frontend (Vite)

```bash
cd frontend
npm install
npm run dev
```

- App em `http://localhost:5173`
- O Vite já faz proxy de `/api` → `http://localhost:8000`, então é só abrir e usar.

---

## 🚀 Deploy no Railway (passo a passo)

1. **Suba o código pro GitHub** (já está na branch do projeto).
2. No [railway.app](https://railway.app): **New Project → Deploy from GitHub repo** → escolha este repositório.
3. O Railway detecta o `Dockerfile` e faz o build sozinho.
4. **Adicione o banco:** dentro do projeto, **New → Database → PostgreSQL**.
   O Railway cria a variável `DATABASE_URL` — o backend já lê ela automaticamente.
5. **Variáveis de ambiente** (aba *Variables* do serviço):
   - `JWT_SECRET` → gere uma chave forte: `openssl rand -hex 32`
   - (`DATABASE_URL` já vem do Postgres; `PORT` o Railway injeta sozinho.)
6. Em **Settings → Networking → Generate Domain** pra ter uma URL pública
   (ex: `https://volante-production.up.railway.app`).
7. Pronto: abra a URL e o app está no ar. 🎉

> **Dica:** a cada `git push` na branch conectada, o Railway redeploya sozinho.

---

## 📱 Testar no celular (passo a passo)

Como é um PWA, testar em qualquer aparelho é só abrir o link:

1. No celular (mesmo Android ou iPhone), abra o navegador (**Chrome** no Android,
   **Safari** no iPhone).
2. Digite a **URL do Railway** (a que você gerou no passo 6 acima).
3. Crie sua conta e use normalmente.
4. Pra virar "app de verdade" na tela inicial:
   - **Android/Chrome:** menu **⋮ → Instalar app** (ou "Adicionar à tela inicial").
   - **iPhone/Safari:** botão **Compartilhar** → **Adicionar à Tela de Início**.
5. Vai aparecer o ícone do Volante na tela inicial, abrindo em tela cheia, sem barra
   do navegador — igual app nativo.

### Testar em rede local (antes do Railway)

Quer testar no celular direto do seu PC, sem subir ainda?

1. Rode backend e frontend como acima.
2. Descubra o IP do PC na rede (ex: `192.168.0.10`).
3. Suba o Vite exposto: `npm run dev -- --host`
4. No celular (mesmo Wi-Fi), abra `http://192.168.0.10:5173`.
   > Obs: pra rede local funcionar 100%, aponte o proxy/API para o IP do PC.
   > O jeito mais simples de testar em outros lugares é mesmo pelo Railway.

---

## 🧮 O que o app calcula

- **Lucro líquido** = ganhos brutos − gastos (por dia/semana/mês)
- **Lucro por hora** e **lucro por km** (o número que importa de verdade)
- **Ganho por corrida** e total de km/horas/dias trabalhados
- **Progresso da meta** (diária, semanal ou mensal)

---

## 🗺️ Roadmap (próximas fases)

Já entregue (MVP): **Auth · Dashboard · Jornadas · Gastos · Metas**.

Próximos módulos planejados:
- 🔧 **Manutenção** com alertas por km/data (óleo, pneu, revisão)
- 💳 **Cartões e faturas** (vencimentos, fluxo de caixa)
- 🚙 **Veículo** (consumo médio, custo por km real)
- 📅 **Calendário** de jornadas e folgas
- 📊 **Gráficos** de tendência e comparativos
- 📤 **Exportar** relatórios (PDF/planilha)
- 🔔 Notificações (PWA push)
