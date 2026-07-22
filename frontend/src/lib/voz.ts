// Reconhecimento de voz + interpretacao de "falar a corrida".
//
// Ex.: "fiz uma corrida agora de 50 reais e 2 km na uber"
//   -> { valor: 50, km: 2, plataforma: "uber" }
//
// A fala vira texto pela Web Speech API (funciona no Chrome/PWA). No APK
// (WebView) ela nao existe -> reconhecimentoDisponivel() retorna false e a
// tela mostra o aviso. O parser abaixo e puro e funciona em qualquer lugar.

export interface CorridaVoz {
  valor: number | null;
  km: number | null;
  plataforma: string | null;
  texto: string;
}

const UNI: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};
const DEZ: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90,
};
const CEM: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400,
  quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800,
  novecentos: 900,
};

function ehNumero(w: string): boolean {
  return w in UNI || w in DEZ || w in CEM || w === "mil";
}

function valorDaSequencia(tokens: string[]): number {
  let total = 0;
  let atual = 0;
  for (const t of tokens) {
    if (t === "e") continue;
    if (t in UNI) atual += UNI[t];
    else if (t in DEZ) atual += DEZ[t];
    else if (t in CEM) atual += CEM[t];
    else if (t === "mil") {
      atual = (atual === 0 ? 1 : atual) * 1000;
      total += atual;
      atual = 0;
    }
  }
  return total + atual;
}

// Substitui numeros por extenso ("cinquenta e cinco") por digitos ("55").
function numerosPorExtenso(texto: string): string {
  const toks = texto.split(/\s+/);
  const out: string[] = [];
  let run: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const conector = t === "e" && run.length > 0 && i + 1 < toks.length && ehNumero(toks[i + 1]);
    if (ehNumero(t)) {
      run.push(t);
    } else if (conector) {
      run.push("e");
    } else {
      if (run.length) { out.push(String(valorDaSequencia(run))); run = []; }
      out.push(t);
    }
  }
  if (run.length) out.push(String(valorDaSequencia(run)));
  return out.join(" ");
}

export function interpretarCorrida(bruto: string): CorridaVoz {
  const texto = numerosPorExtenso(
    bruto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  );

  let valor: number | null = null;
  let km: number | null = null;

  // valor: "50 reais [e 50 centavos]" ou "r$ 50"
  const mReais = texto.match(
    /(\d+(?:[.,]\d+)?)\s*(?:reais|real|pila|conto|contos)\b(?:\s*e\s*(\d+)\s*centavos)?/
  );
  if (mReais) {
    valor = parseFloat(mReais[1].replace(",", "."));
    if (mReais[2]) valor += parseInt(mReais[2], 10) / 100;
  } else {
    const mCifra = texto.match(/r\$\s*(\d+(?:[.,]\d+)?)/);
    if (mCifra) valor = parseFloat(mCifra[1].replace(",", "."));
  }

  // km: "2 km", "2 quilometros"
  const mKm = texto.match(
    /(\d+(?:[.,]\d+)?)\s*(?:km\b|quilometros?\b|kilometros?\b|quilos?\b)/
  );
  if (mKm) km = parseFloat(mKm[1].replace(",", "."));

  // plataforma: detecta no texto sem os trechos ja usados (evita confundir 99 reais)
  let resto = texto;
  if (mReais) resto = resto.replace(mReais[0], " ");
  if (mKm) resto = resto.replace(mKm[0], " ");
  let plataforma: string | null = null;
  if (/\b99\b/.test(resto)) plataforma = "99";
  else if (/\buber\b/.test(resto)) plataforma = "uber";
  else if (/in\s*driv|indraiv/.test(resto)) plataforma = "indrive";
  else if (/particular|outra|outro/.test(resto)) plataforma = "outra";

  // fallback do valor: primeiro numero que nao seja o km, se nao achou "reais"
  if (valor === null) {
    const kmStr = mKm ? mKm[1] : null;
    for (const m of texto.matchAll(/\d+(?:[.,]\d+)?/g)) {
      if (m[0] !== kmStr) { valor = parseFloat(m[0].replace(",", ".")); break; }
    }
  }

  return { valor, km, plataforma, texto: bruto.trim() };
}

// ---------- Reconhecimento de fala (Web Speech API) ----------
/* eslint-disable @typescript-eslint/no-explicit-any */
function getSR(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function reconhecimentoDisponivel(): boolean {
  return !!getSR();
}

/** Ouve uma frase em pt-BR e resolve com o texto reconhecido. */
export function ouvirCorrida(): Promise<string> {
  return new Promise((resolve, reject) => {
    const SR = getSR();
    if (!SR) { reject(new Error("indisponivel")); return; }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    let ok = false;
    rec.onresult = (e: any) => { ok = true; resolve(e.results[0][0].transcript as string); };
    rec.onerror = (e: any) => reject(new Error(e.error || "erro"));
    rec.onend = () => { if (!ok) reject(new Error("sem-fala")); };
    try { rec.start(); } catch { reject(new Error("erro")); }
  });
}
