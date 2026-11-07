import { useId, useState } from "react";

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

const shortDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * "Ilha" de resumo da campanha, mostrada no lugar do painel do criador enquanto nenhum está selecionado. Fechada é uma
 * pílula (progresso, o que precisa de ação, atrasos e o próximo prazo); ao tocar, abre por baixo com as pendências por
 * etapa, os atrasados (com "Cobrar") e todos os prazos.
 */
export function ManagementSummary({ progress, attention, attentionTotal, late, deadlines, inDays, onAttention, onCharge }: Props) {
  const [open, setOpen] = useState(false);
  const [lateOpen, setLateOpen] = useState(false);
  const bodyId = useId();
  const pct = Math.round(progress);
  const next = deadlines[0];
  return (
    <section className={`isl isl-s${open ? " isl-open" : ""}`} aria-label="Resumo da campanha">
      <button
        type="button"
        className="isl-h isl-hb"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="isl-ring" style={{ ["--p" as string]: pct }}>
          <b>{pct}%</b>
        </span>
        <span className="isl-lbl">concluído</span>
        <span className="isl-seg" data-tone={attentionTotal > 0 ? "warn" : "ok"}>
          <i aria-hidden />
          {attentionTotal > 0
            ? `${attentionTotal} ${attentionTotal === 1 ? "precisa" : "precisam"} da sua ação`
            : "Nada pendente"}
        </span>
        <span className="isl-seg" data-tone={late.length > 0 ? "bad" : "ok"}>
          <i aria-hidden />
          {late.length > 0 ? `${late.length} em atraso` : "Em dia"}
        </span>
        {next ? <span className="isl-seg isl-next">Prazo {shortDate(next[1])}</span> : null}
        <span className="isl-chev" aria-hidden>
          <I n="chevdown" cls="sm" />
        </span>
      </button>

      <div id={bodyId} className="isl-b" inert={!open}>
        <div className="isl-bi">
          <div className="isl-sheet ms">
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
                      <b>{shortDate(d)}</b> {label}
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
          </div>
        </div>
      </div>
    </section>
  );
}
