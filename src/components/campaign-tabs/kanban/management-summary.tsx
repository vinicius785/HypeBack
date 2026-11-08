import type { ReactNode } from "react";

import type { ExtendedInfluencer } from "../management-kanban-config";

interface Props {
  /** Barra de etapas/filtros do quadro, mostrada dentro da ilha, abaixo da pílula. */
  dock?: ReactNode;
  progress: number;
  /** Quantos criadores precisam da ação de quem gerencia. */
  attentionTotal: number;
  /** Criadores em atraso (só a contagem aparece). */
  late: ExtendedInfluencer[];
  /** Próximos prazos, em ordem; só o primeiro aparece. */
  deadlines: Array<[string, Date]>;
  inDays: (d: Date) => string;
}

const shortDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * "Ilha" de resumo da campanha, mostrada no lugar do painel do criador enquanto nenhum está selecionado. É só a pílula
 * (progresso, o que precisa de ação, atrasos e o próximo prazo): tudo já cabe fechado, então não há o que abrir.
 */
export function ManagementSummary({ dock, progress, attentionTotal, late, deadlines, inDays }: Props) {
  const pct = Math.round(progress);
  const next = deadlines[0];
  return (
    <section className="isl isl-s" aria-label="Resumo da campanha">
      <div className="isl-h">
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
        {next ? (
          <span className="isl-seg isl-next" title={`${next[0]}: ${inDays(next[1])}`}>
            {next[0]} {shortDate(next[1])}
          </span>
        ) : null}
      </div>
      {dock}
    </section>
  );
}
