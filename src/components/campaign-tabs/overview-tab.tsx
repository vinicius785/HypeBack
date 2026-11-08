import { useMemo } from "react";

import { Av, I } from "@/components/prototype/ui";
import type { CampaignPhase } from "@/shared/types";
import {
  isLate,
  lateLabel,
  type FlowParticipant,
} from "./campaign-flow";

interface OverviewTabProps {
  participants: FlowParticipant[];
  isLoading: boolean;
  /** 0–100 */
  progress: number;
  reach: number;
  engagement: number;
  phases: CampaignPhase[];
  /** Abre o quadro na etapa certa, já filtrado por "precisa da minha ação". */
  onGoTile: (tile: string) => void;
  /** Abre o chat com o criador (cobrança). */
  onRemind: (p: FlowParticipant) => void;
}

const SELECTION = [
  "applications",
  "pre_selection",
  "pre_selection_curation",
  "curation",
  "invited",
];

const SH: Record<string, string> = {
  scr: "Roteiros para aprovar",
  cont: "Conteúdos para aprovar",
  ctr: "Contraproposta para responder",
  pay: "Pagamento para liberar",
  cur: "Criadores para curar",
  ship: "Produto para enviar",
  app: "Inscrições novas",
};
const ICON: Record<string, string> = {
  scr: "file",
  cont: "image",
  ctr: "banknote",
  pay: "wallet",
  cur: "users",
  ship: "box",
  app: "user",
};

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

/** "Márcia, Leydiane e mais 15" — quem está esperando, pelo primeiro nome. */
const namesOf = (people: FlowParticipant[]) => {
  const first = people.slice(0, 2).map((p) => p.raw.name.trim().split(/\s+/)[0]);
  const rest = people.length - first.length;
  if (rest <= 0) return first.join(" e ");
  return `${first.join(", ")} e mais ${rest}`;
};

/** Visão geral — mesma estrutura do protótipo. */
export function OverviewTab({
  participants,
  isLoading,
  progress,
  reach,
  engagement,
  phases,
  onGoTile,
  onRemind,
}: OverviewTabProps) {
  const count = (...cols: string[]) =>
    participants.filter((p) => cols.includes(p.column)).length;

  const P = participants.filter(
    (p) => !SELECTION.includes(p.column) && p.column !== "rejected",
  ).length;

  const attention = useMemo(
    () =>
      [
        { k: "scr", cols: ["script_pending"], tab: "scr" },
        { k: "cont", cols: ["pending_approval"], tab: "cont" },
        { k: "ctr", cols: ["price_countered"], tab: "prop" },
        { k: "pay", cols: ["payment_pending"], tab: "pay" },
        { k: "cur", cols: ["curation", "pre_selection_curation"], tab: "cur" },
        { k: "ship", cols: ["awaiting_shipment"], tab: "ship" },
        { k: "app", cols: ["applications"], tab: "apps" },
      ]
        .map((a) => {
          const people = participants.filter((p) => a.cols.includes(p.column));
          return { k: a.k, tab: a.tab, n: people.length, people };
        })
        .filter((a) => a.n > 0),
    [participants],
  );
  const total = attention.reduce((s, a) => s + a.n, 0);
  const late = participants.filter(isLate);

  const rotOk = count(
    "awaiting_shipment",
    "awaiting_receipt",
    "content_pending",
    "pending_approval",
    "in_correction",
    "content_approved",
    "payment_pending",
    "published",
  );
  const contOk = count("content_approved", "payment_pending", "published");
  const pub = count("published");
  const selDone = P > 0 && count(...SELECTION) === 0;

  const lastPhase = phases[phases.length - 1];
  const steps: Array<[string, string, string, boolean]> = [
    ["Seleção", "", `${P} pessoas`, selDone],
    [
      "Roteiros",
      "",
      `${rotOk} de ${P}`,
      P > 0 && rotOk === P,
    ],
    [
      "Conteúdos",
      phases[0]?.contentSubmissionDeadline
        ? `até ${fmtDate(phases[0].contentSubmissionDeadline)}`
        : "",
      `${contOk} de ${P}`,
      P > 0 && contOk === P,
    ],
    [
      "Publicação",
      lastPhase?.postDate ? fmtDate(lastPhase.postDate) : "",
      `${pub} de ${P}`,
      P > 0 && pub === P,
    ],
    ["Pagamento", "após publicar", `${pub} de ${P}`, P > 0 && pub === P],
  ];
  const curIdx = steps.findIndex((s) => !s[3]);
  const cur = curIdx === -1 ? steps.length - 1 : curIdx;

  const kpis: Array<[string, string, string]> = [
    ["Criadores na campanha", String(P), "users"],
    ["Conteúdos no ar", `${pub} de ${P}`, "image"],
    ["Alcance total", reach ? reach.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 }) : "—", "eye"],
    ["Engajamento", engagement ? `${engagement.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—", "trend"],
  ];

  return (
    <div className="pv">
    <div className="fade ov">
      {isLoading ? (
        <div className="card pg">
          <div className="sk" style={{ height: 230 }} />
        </div>
      ) : (
        <div className="card pg">
          <div className="pg-top">
            <div>
              <small className="pg-l">Progresso geral</small>
              <div className="pg-n">
                <b>{Math.round(progress)}%</b>
                <span>{P === 0 ? "campanha ainda não iniciada" : "concluído"}</span>
              </div>
              <div
                className="pg-bar"
                role="progressbar"
                aria-label="Progresso geral da campanha"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                <i style={{ ["--p" as string]: `${Math.max(0, Math.min(100, progress))}%` }} />
              </div>
            </div>
            <ol className="tl" aria-label="Etapas da campanha">
              {steps.map(([t, d, c, done], k) => (
                <li
                  key={t}
                  className={`tl-s ${done ? "done" : k === cur ? "cur" : ""}`}
                  style={{ ["--i" as string]: k }}
                  aria-current={!done && k === cur ? "step" : undefined}
                >
                  <i className="tl-b" />
                  <b>
                    {done && <I n="check" cls="sm" />}
                    {t}
                  </b>
                  <small>{d || " "}</small>
                  <em>{c}</em>
                </li>
              ))}
            </ol>
          </div>
          <div className="kp2">
            {kpis.map(([l, v, i]) => (
              <div key={l}>
                <span className="mi">
                  <I n={i} />
                </span>
                <div>
                  <small>{l}</small>
                  <b>{v}</b>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="card attn">
        <div className="card-h" style={{ marginBottom: 14 }}>
          <div>
            <h2>Precisa da sua ação</h2>
            <p className="sub">
              {isLoading ? "Carregando…" : attention.length ? `${total} itens aguardando` : "Nada pendente"}
            </p>
          </div>
        </div>
        {isLoading ? (
          <div className="sk" style={{ height: 168, borderRadius: 24 }} />
        ) : attention.length ? (
          <ul className="al">
            {attention.map((a, k) => (
              <li key={a.k} style={{ ["--i" as string]: k }}>
                <button type="button" className="al-r" onClick={() => onGoTile(a.tab)}>
                  <span className="al-ic">
                    <I n={ICON[a.k]} />
                  </span>
                  <span className="al-tx">
                    <b>{SH[a.k]}</b>
                    <small>{namesOf(a.people)}</small>
                  </span>
                  <span className="al-st" aria-hidden="true">
                    {a.people.slice(0, 4).map((p) => (
                      <span key={p.raw.id} className="al-av">
                        <Av name={p.raw.name} src={p.raw.avatar} size={28} />
                      </span>
                    ))}
                    {a.n > 4 && <span className="al-more">+{a.n - 4}</span>}
                  </span>
                  <span className="al-n">{a.n}</span>
                  <I n="chev" cls="sm al-ch" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty big ok">
            <span className="ei">
              <I n="check" />
            </span>
            <b>Tudo em dia</b>
            <p>Nenhum roteiro, conteúdo ou criador aguardando você agora.</p>
          </div>
        )}

        {!isLoading && late.length > 0 && (
          <div className="late2">
            <div className="card-h" style={{ marginBottom: 16 }}>
              <div>
                <h2>Em atraso</h2>
                <p className="sub">{late.length} criadores fora do prazo</p>
              </div>
            </div>
            <div className="lts">
              {late.map((p, k) => (
                <div key={p.raw.id} className="lk" style={{ ["--i" as string]: k }}>
                  <Av name={p.raw.name} src={p.raw.avatar} size={42} />
                  <div className="lx">
                    <b>{p.raw.name}</b>
                    <small>{lateLabel(p)}</small>
                  </div>
                  <button className="rm" onClick={() => onRemind(p)}>
                    Cobrar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
    </div>
  );
}
