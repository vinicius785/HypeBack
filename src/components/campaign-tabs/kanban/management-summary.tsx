import { useState } from "react";

import { Av, I } from "@/components/prototype/ui";
import type { StageKey } from "../campaign-flow";
import type { ExtendedInfluencer } from "../management-kanban-config";
import { idleDaysOf } from "./influencer-card";

export interface SummaryAttention {
  n: number;
  label: string;
  stage: StageKey;
}

interface Props {
  progress: number;
  attention: SummaryAttention[];
  attentionTotal: number;
  late: ExtendedInfluencer[];
  deadlines: Array<[string, Date]>;
  inDays: (d: Date) => string;
  onAttention: (stage: StageKey) => void;
  onCharge: (inf: ExtendedInfluencer) => void;
}

/**
 * Faixa de resumo da campanha, mostrada no lugar do painel de detalhes enquanto nenhum criador está selecionado:
 * progresso, o que precisa da ação de quem gerencia, atrasos (com "Cobrar") e próximos prazos.
 */
export function ManagementSummary({ progress, attention, attentionTotal, late, deadlines, inDays, onAttention, onCharge }: Props) {
  const [lateOpen, setLateOpen] = useState(false);
  const pct = Math.round(progress);
  return (
    <section className="ms" aria-label="Resumo da campanha">
      <div className="ms-p">
        <b>{pct}%</b>
        <div>
          <small>concluído</small>
          <div className="cc-trk">
            <i style={{ ["--w" as string]: `${pct}%`, ["--i" as string]: 0 }} />
          </div>
        </div>
      </div>

      <div className="ms-g">
        <span className="ms-l">
          Precisa da sua ação<em>{attentionTotal}</em>
        </span>
        <div className="ms-c">
          {attention.length === 0 ? <small>Nada pendente.</small> : null}
          {attention.map((a) => (
            <button key={a.label} type="button" className="ms-chip" onClick={() => onAttention(a.stage)}>
              <b>{a.n}</b>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ms-g">
        <span className="ms-l">
          Em atraso<em>{late.length}</em>
        </span>
        <div className="ms-c">
          {late.length === 0 ? (
            <small>Ninguém atrasado.</small>
          ) : (
            <button
              type="button"
              className="ms-chip"
              aria-expanded={lateOpen}
              onClick={() => setLateOpen((v) => !v)}
            >
              {lateOpen ? "Ocultar" : "Ver"} {late.length === 1 ? "o criador" : "os criadores"}
              <I n={lateOpen ? "chevup" : "chevdown"} cls="sm" />
            </button>
          )}
        </div>
      </div>

      {deadlines.length > 0 ? (
        <div className="ms-g">
          <span className="ms-l">Próximos prazos</span>
          <div className="ms-c">
            {deadlines.map(([label, d]) => (
              <span key={label} className="ms-dl">
                <b>{d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</b> {label}
                <small>{inDays(d)}</small>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {lateOpen && late.length > 0 ? (
        <ul className="ms-late" aria-label="Criadores em atraso">
          {late.map((inf) => (
            <li key={inf.id}>
              <Av name={inf.name} src={inf.avatar} size={28} />
              <div>
                <b>{inf.name}</b>
                <small>{idleDaysOf(inf)} dias sem avanço</small>
              </div>
              <button type="button" className="rm" onClick={() => onCharge(inf)}>
                Cobrar
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
