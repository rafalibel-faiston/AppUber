import { useState } from "react";
import { brl } from "../lib/format";
import type { SerieDia } from "../lib/types";

function diaLabel(iso: string): string {
  const [, , d] = iso.split("-");
  return String(Number(d));
}
function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default function GraficoGanhos({ serie }: { serie: SerieDia[] }) {
  // seleciona o ultimo dia por padrao (hoje)
  const [sel, setSel] = useState<number | null>(serie.length ? serie.length - 1 : null);

  const posMax = Math.max(0, ...serie.map((d) => d.lucro));
  const negMax = Math.max(0, ...serie.map((d) => -d.lucro));
  const denom = posMax + negMax || 1;
  const posPct = (posMax / denom) * 100; // altura da zona positiva

  const total = serie.reduce((s, d) => s + d.lucro, 0);
  const atual = sel !== null ? serie[sel] : null;

  return (
    <div className="card grafico">
      <div className="graf-head">
        {atual ? (
          <>
            <div className="gh-label">{ddmm(atual.data)} · {atual.corridas} corr.</div>
            <div className={`gh-val ${atual.lucro >= 0 ? "pos" : "neg"}`}>{brl(atual.lucro)}</div>
          </>
        ) : (
          <>
            <div className="gh-label">Lucro no período</div>
            <div className={`gh-val ${total >= 0 ? "pos" : "neg"}`}>{brl(total)}</div>
          </>
        )}
      </div>

      <div className="graf-bars">
        {serie.map((d, i) => (
          <button
            key={d.data}
            className={`gcol ${sel === i ? "on" : ""}`}
            onClick={() => setSel(i)}
            aria-label={`${ddmm(d.data)}: ${brl(d.lucro)}`}
          >
            <div className="pos-zone" style={{ height: `${posPct}%` }}>
              {d.lucro >= 0 && posMax > 0 && (
                <span className="bar pos" style={{ height: `${(d.lucro / posMax) * 100}%` }} />
              )}
            </div>
            <div className="neg-zone" style={{ height: `${100 - posPct}%` }}>
              {d.lucro < 0 && negMax > 0 && (
                <span className="bar neg" style={{ height: `${(-d.lucro / negMax) * 100}%` }} />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="graf-labels">
        {serie.map((d, i) => (
          <span key={d.data} className={sel === i ? "on" : ""}>
            {diaLabel(d.data)}
          </span>
        ))}
      </div>
    </div>
  );
}
