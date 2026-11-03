import type { ReactNode } from "react";

import { Av, I } from "@/components/prototype/ui";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import { COLUMN_LABEL, formatEngagement, formatFollowers } from "../campaign-flow";
import type { ExtendedInfluencer } from "../management-kanban-config";
import { fullDate, enrolledAt } from "./card-info";

/** Grupo do painel: título discreto e divisória; o conteúdo define o destaque. */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pn-s" aria-label={title}>
      <h5>{title}</h5>
      {children}
    </section>
  );
}

export function PanelIdentity({
  inf,
  late,
  idle,
}: {
  inf: ExtendedInfluencer;
  late: boolean;
  idle?: number;
}) {
  const nets = inf.social_networks ?? [];
  return (
    <PanelSection title="Identificação">
      <div className="pn-id">
        <Av name={inf.name} src={inf.avatar} size={56} />
        <div>
          <h2>
            {inf.name}
            {inf.isExternal ? <em className="ext">Externo</em> : null}
          </h2>
          <p>{inf.username ? `@${inf.username}` : "Sem usuário"}</p>
        </div>
      </div>
      {nets.length > 0 ? (
        <ul className="pn-nets" aria-label="Redes sociais">
          {nets.map((n) => (
            <li key={n.id}>
              <b>{getNetworkLabel(n.type, n.type)}</b>
              {n.username ? <span>@{n.username}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {late ? (
        <span className="lt2 flag">
          <I n="clock" cls="sm" />
          {idle} dias sem avanço
        </span>
      ) : null}
    </PanelSection>
  );
}

export function PanelPerformance({ inf }: { inf: ExtendedInfluencer }) {
  const rows: Array<[string, string]> = [];
  if (inf.nicheName) rows.push(["Nicho", inf.nicheName]);
  return (
    <PanelSection title="Desempenho">
      <div className="drw-st">
        <div>
          <small>Seguidores</small>
          <b>{formatFollowers(inf.followers)}</b>
        </div>
        <div>
          <small>Engajamento</small>
          <b>{inf.engagement ? formatEngagement(inf.engagement) : "—"}</b>
        </div>
      </div>
      {rows.length > 0 ? (
        <dl className="pn-kv">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </PanelSection>
  );
}

/** Negociação de valor (valores e respostas vêm do `PriceNegotiationSection`); só existe com negociação na API. */
export function PanelFinancial({ inf, children }: { inf: ExtendedInfluencer; children?: ReactNode }) {
  if (!inf.price_negotiation) return null;
  return <PanelSection title="Proposta e financeiro">{children}</PanelSection>;
}

/** Movimentações em ordem cronológica, da mais recente para a mais antiga. */
export function PanelHistory({ inf }: { inf: ExtendedInfluencer }) {
  const entries = [...(inf.statusHistory ?? [])].reverse();
  const since = enrolledAt(inf);
  return (
    <PanelSection title="Histórico">
      {since ? <p className="pn-since">Inscrito em {fullDate(since)}</p> : null}
      {entries.length === 0 ? (
        <p className="pn-since">Sem movimentações registradas.</p>
      ) : (
        <ol className="pn-hist">
          {entries.map((h, k) => {
            const d = new Date(h.timestamp);
            return (
              <li key={h.id} className={k === 0 ? "cur" : ""}>
                <i aria-hidden="true" />
                <div>
                  <b>{COLUMN_LABEL[h.status] ?? h.status}</b>
                  <small>
                    {Number.isNaN(d.getTime())
                      ? ""
                      : `${fullDate(d)} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                  </small>
                  {h.notes ? <span>{h.notes}</span> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </PanelSection>
  );
}
