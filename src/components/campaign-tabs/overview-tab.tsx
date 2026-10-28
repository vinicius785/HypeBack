import { useEffect, useMemo, useRef } from "react";

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
const BT: Record<string, string> = {
  scr: "Revisar",
  cont: "Revisar",
  ctr: "Responder",
  pay: "Pagar",
  cur: "Curar",
  ship: "Enviar",
  app: "Triar",
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
        { k: "scr", n: count("script_pending"), tab: "scr" },
        { k: "cont", n: count("pending_approval"), tab: "cont" },
        { k: "ctr", n: count("price_countered"), tab: "prop" },
        { k: "pay", n: count("payment_pending"), tab: "pay" },
        { k: "cur", n: count("curation", "pre_selection_curation"), tab: "cur" },
        { k: "ship", n: count("awaiting_shipment"), tab: "ship" },
        { k: "app", n: count("applications"), tab: "apps" },
      ].filter((a) => a.n > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const acsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tr = acsRef.current;
    if (!tr) return;
    let down = false;
    let sx = 0;
    let sl = 0;
    let moved = false;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      down = true;
      moved = false;
      sx = e.clientX;
      sl = tr.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 5) {
        moved = true;
        tr.classList.add("drag");
      }
      if (moved) tr.scrollLeft = sl - dx;
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      tr.classList.remove("drag");
    };
    tr.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      tr.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [attention.length, isLoading]);

  const scrollAcs = (dir: -1 | 1) =>
    acsRef.current?.scrollBy({ left: dir * 226, behavior: "smooth" });

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
            </div>
            <div className="jr" style={{ ["--w" as string]: P === 0 ? 0 : (cur / (steps.length - 1)) * 100 }}>
              <i className="jl" />
              <i className="jf" />
              {steps.map(([t, d, c, done], k) => (
                <div key={t} className={`js ${done ? "done" : k === cur ? "cur" : ""}`}>
                  <span className="jd">{done ? <I n="check" cls="sm" /> : k + 1}</span>
                  <b>{t}</b>
                  <small>{d || " "}</small>
                  <em>{c}</em>
                </div>
              ))}
            </div>
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
        <div className="card-h" style={{ marginBottom: 18 }}>
          <div>
            <h2>Precisa da sua ação</h2>
            <p className="sub">
              {isLoading ? "Carregando…" : attention.length ? `${total} itens aguardando` : "Nada pendente"}
            </p>
          </div>
          {attention.length > 3 && (
            <div className="ctl">
              <button className="round" aria-label="Anterior" onClick={() => scrollAcs(-1)}>
                <I n="chev" cls="sm rot" />
              </button>
              <button className="round" aria-label="Próximo" onClick={() => scrollAcs(1)}>
                <I n="chev" cls="sm" />
              </button>
            </div>
          )}
        </div>
        <div className="acs" ref={acsRef}>
          {isLoading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="sk" style={{ height: 230, borderRadius: 28 }} />
            ))
          ) : attention.length ? (
            attention.map((a, k) => (
              <article key={a.k} className={`ac ${k === 0 ? "first" : ""}`} style={{ ["--i" as string]: k }}>
                <span className="aic">
                  <I n={ICON[a.k]} />
                </span>
                <b className="aq">{a.n}</b>
                <h3>{SH[a.k]}</h3>
                <button className="ab2" onClick={() => onGoTile(a.tab)}>
                  {BT[a.k]}
                  <I n="chev" cls="sm" />
                </button>
              </article>
            ))
          ) : (
            <div className="empty big ok" style={{ gridColumn: "1/-1" }}>
              <span className="ei">
                <I n="check" />
              </span>
              <b>Tudo em dia</b>
              <p>Nenhum roteiro, conteúdo ou criador aguardando você agora.</p>
            </div>
          )}
        </div>

        <div className="late2">
          <div className="card-h" style={{ marginBottom: 16 }}>
            <div>
              <h2>Em atraso</h2>
              <p className="sub">
                {isLoading ? "Carregando…" : late.length ? `${late.length} criadores fora do prazo` : "Prazos em dia"}
              </p>
            </div>
          </div>
          {isLoading ? (
            <div className="sk" style={{ height: 120 }} />
          ) : late.length ? (
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
          ) : (
            <div className="empty">
              <span className="ei">
                <I n="check" />
              </span>
              <b>Ninguém atrasado</b>
              <p>Todos os criadores estão dentro do prazo.</p>
            </div>
          )}
        </div>
      </section>
    </div>
    </div>
  );
}
