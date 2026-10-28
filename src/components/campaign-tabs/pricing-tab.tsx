import { useEffect, useMemo, useRef, useState } from "react";

import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import {
  useAutoReserve,
  useCampaignPricing,
  useInfluencerQuote,
  useSetStepNetworkPrice,
} from "@/hooks/use-pricing";
import type {
  InfluencerQuote,
  StepBreakdown,
} from "@/shared/services/pricing";
import { formatDateOrInstantPtBr } from "@/shared/utils/civil-date";

const fmtH = (n: number): string =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);

const formatHype = (value: string | undefined): string => {
  if (!value) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return fmtH(num);
};

const WAVE = Array.from({ length: 56 }, (_, i) =>
  Math.round(26 + 74 * Math.abs(Math.sin(i * 0.83) * Math.cos(i * 0.31 + 1))),
);
const DIST_COLS = ["#050505", "#9e2cfa", "#7e7e7e"];
const NET_ICONS = new Set(["instagram", "tiktok", "youtube"]);

const toNum = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function PricingTab() {
  const { campaignId } = useParams({
    from: "/(private)/(app)/campaigns/$campaignId",
  });
  const pricingQ = useCampaignPricing(campaignId);
  const setPrice = useSetStepNetworkPrice();
  const [drafts, setDrafts] = useState<Record<number, number>>({});

  const data = pricingQ.data;
  const isFixed =
    data?.paymentMethod === "fixed" || data?.paymentMethod === "fixed_value";

  // Descarta rascunhos já refletidos pelo servidor.
  useEffect(() => {
    if (!data) return;
    const server = new Map<number, number>();
    data.steps.forEach((s) =>
      s.networks.forEach((n) =>
        server.set(n.stepNetworkId, toNum(n.priceFormatted)),
      ),
    );
    setDrafts((d) => {
      const next: Record<number, number> = {};
      let changed = false;
      for (const [k, v] of Object.entries(d)) {
        if (server.get(Number(k)) === v) changed = true;
        else next[Number(k)] = v;
      }
      return changed ? next : d;
    });
  }, [data]);

  const valueOf = (id: number, priceFormatted: string): number =>
    drafts[id] ?? toNum(priceFormatted);

  // Escala da barra: baseada nos valores do servidor (estável durante o arraste).
  const max = useMemo(() => {
    let m = 0;
    data?.steps.forEach((s) =>
      s.networks.forEach((n) => {
        m = Math.max(m, toNum(n.priceFormatted));
      }),
    );
    return Math.max(1000, Math.ceil((m * 1.2) / 100) * 100);
  }, [data]);

  const phaseSums = (data?.steps ?? []).map((s) =>
    s.networks.reduce((a, n) => a + valueOf(n.stepNetworkId, n.priceFormatted), 0),
  );
  const total = phaseSums.reduce((a, b) => a + b, 0);
  const pricedPhases = (data?.steps ?? []).filter((s) =>
    s.networks.some((n) => valueOf(n.stepNetworkId, n.priceFormatted) > 0),
  ).length;

  const commit = async (
    id: number,
    value: number,
    serverFormatted: string,
  ): Promise<void> => {
    if (value === toNum(serverFormatted)) {
      setDrafts((d) => {
        const { [id]: _omit, ...rest } = d;
        return rest;
      });
      return;
    }
    try {
      await setPrice.mutateAsync({ stepNetworkId: id, priceHuman: String(value) });
      toast.success(`Preço atualizado para ${fmtH(value)} HYPE.`);
    } catch (e: any) {
      setDrafts((d) => {
        const { [id]: _omit, ...rest } = d;
        return rest;
      });
      toast.error(`Erro: ${e?.message ?? "falha"}`);
    }
  };

  const setDraft = (id: number, v: number) =>
    setDrafts((d) => ({ ...d, [id]: v }));

  return (
    <div className="pv">
      <div className="mg">
        <div className="gwrap">
          <div className="gmain card gjm">
            <div className="gjh">
              <div>
                <h2>Pricing por entregável</h2>
                <p className="sub">
                  Arraste a barra ou digite o valor em HYPE de cada fase por
                  rede.
                </p>
              </div>
              <div className="gjp">
                <b>
                  {fmtH(total)}
                  <span> HYPE no total</span>
                </b>
              </div>
            </div>

            {data && !isFixed && (
              <p className="sub" style={{ margin: "0 0 16px", color: "#b45309" }}>
                Esta campanha usa <b>{data.paymentMethod}</b>. O pricing por
                entregável é projetado para a modalidade fixed; troque a
                modalidade em "Editar" para usar este pricing.
              </p>
            )}

            <div className="gscroll prs">
              {pricingQ.isLoading ? (
                <p className="sub">Carregando…</p>
              ) : pricingQ.error ? (
                <p className="sub" style={{ color: "#dc2626" }}>
                  Erro: {pricingQ.error.message}
                </p>
              ) : data && data.steps.length === 0 ? (
                <p className="sub">
                  Esta campanha ainda não tem fases. Adicione fases em "Editar"
                  antes de configurar o pricing.
                </p>
              ) : (
                data?.steps.map((step, k) => (
                  <PhaseSection
                    key={step.stepId}
                    step={step}
                    index={k}
                    sum={phaseSums[k] ?? 0}
                    total={total}
                    max={max}
                    valueOf={valueOf}
                    setDraft={setDraft}
                    commit={commit}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div id="s2h">
          <aside className="side2 fade">
            <div className="s2-top">
              <small>Total máximo</small>
              <div className="s2-p">
                <b>{fmtH(total)}</b>
                <span>HYPE</span>
              </div>
              <div>
                <div className="dbar">
                  {(data?.steps ?? []).map((s, k) => (
                    <i
                      key={s.stepId}
                      style={{
                        flex: phaseSums[k] || 0.001,
                        background: DIST_COLS[k % DIST_COLS.length],
                      }}
                    />
                  ))}
                </div>
                <div className="dleg">
                  {(data?.steps ?? []).map((s, k) => (
                    <span key={s.stepId}>
                      <i style={{ background: DIST_COLS[k % DIST_COLS.length] }} />
                      <span style={{ textTransform: "capitalize" }}>
                        {s.objective}
                      </span>
                      <b>
                        {total ? Math.round(((phaseSums[k] ?? 0) / total) * 100) : 0}%
                      </b>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <section className="s2">
              <h3>Pagamento</h3>
              <div className="s2d" style={{ gridTemplateColumns: "1fr auto" }}>
                <span>Modelo</span>
                <b>{isFixed ? "Valor fixo" : (data?.paymentMethod ?? "—")}</b>
              </div>
              <div className="s2d" style={{ gridTemplateColumns: "1fr auto" }}>
                <span>Fases com preço</span>
                <b>
                  {pricedPhases} de {data?.steps.length ?? 0}
                </b>
              </div>
            </section>

            <QuoteCalculator />
          </aside>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fase + linha editável (barra de onda + input)
// ---------------------------------------------------------------------------

function PhaseSection({
  step,
  index,
  sum,
  total,
  max,
  valueOf,
  setDraft,
  commit,
}: {
  step: StepBreakdown;
  index: number;
  sum: number;
  total: number;
  max: number;
  valueOf: (id: number, priceFormatted: string) => number;
  setDraft: (id: number, v: number) => void;
  commit: (id: number, v: number, serverFormatted: string) => Promise<void>;
}) {
  return (
    <section className="prph2">
      <div className="prh2">
        <span>{index + 1}</span>
        <b style={{ textTransform: "capitalize" }}>{step.objective}</b>
        <small>
          {fmtH(sum)} HYPE
          {step.publishDate
            ? ` · Publicação ${formatDateOrInstantPtBr(step.publishDate)}`
            : ""}
        </small>
      </div>
      {step.networks.length === 0 ? (
        <p className="sub">Esta fase ainda não tem redes sociais associadas.</p>
      ) : (
        <div className="prg">
          {step.networks.map((n) => (
            <PriceRow
              key={n.stepNetworkId}
              id={n.stepNetworkId}
              networkType={n.networkType}
              networkName={n.networkName}
              serverFormatted={n.priceFormatted}
              label={`${step.objective} ${n.networkName}`}
              value={valueOf(n.stepNetworkId, n.priceFormatted)}
              total={total}
              max={max}
              setDraft={setDraft}
              commit={commit}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PriceRow({
  id,
  networkType,
  networkName,
  serverFormatted,
  label,
  value,
  total,
  max,
  setDraft,
  commit,
}: {
  id: number;
  networkType: string;
  networkName: string;
  serverFormatted: string;
  label: string;
  value: number;
  total: number;
  max: number;
  setDraft: (id: number, v: number) => void;
  commit: (id: number, v: number, serverFormatted: string) => Promise<void>;
}) {
  const [drag, setDrag] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const last = useRef(value);
  last.current = value;

  const p = Math.min(1, value / max);
  const share = total ? Math.round((value / total) * 100) : 0;
  const net = networkType.toLowerCase();

  const fromX = (x: number) => {
    const r = waveRef.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const pp = Math.min(1, Math.max(0, (x - r.left) / r.width));
    const v = Math.round((pp * max) / 10) * 10;
    last.current = v;
    setDraft(id, v);
  };

  const endDrag = () => {
    if (!drag) return;
    setDrag(false);
    void commit(id, last.current, serverFormatted);
  };

  const submitText = () => {
    if (text === null) return;
    const v = Number(text.replace(",", ".").trim());
    setText(null);
    if (!Number.isFinite(v) || v < 0) {
      toast.error("Use número decimal não-negativo (ex.: '100' ou '1.5').");
      return;
    }
    setDraft(id, v);
    void commit(id, v, serverFormatted);
  };

  return (
    <div className="pr2">
      <div className="pr2h">
        <span className="pri">
          <I n={NET_ICONS.has(net) ? net : "video"} cls="sm" />
        </span>
        <b>{networkName}</b>
        <span style={{ flex: 1 }} />
        <label className="pr2v">
          <input
            inputMode="decimal"
            aria-label={label}
            value={text ?? String(value)}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setText(e.target.value)}
            onBlur={submitText}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setText(null);
                e.currentTarget.blur();
              }
            }}
          />
          <em>HYPE</em>
        </label>
      </div>
      <div
        ref={waveRef}
        className={`wave${drag ? " drag" : ""}`}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag(true);
          fromX(e.clientX);
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          if (drag) fromX(e.clientX);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          const v = Math.min(
            max,
            Math.max(0, value + (e.key === "ArrowRight" ? 10 : -10)),
          );
          last.current = v;
          setDraft(id, v);
          e.preventDefault();
        }}
        onKeyUp={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight")
            void commit(id, last.current, serverFormatted);
        }}
      >
        <i className="trk">
          <u style={{ width: `${p * 100}%` }} />
        </i>
        <div className="bars">
          {WAVE.map((h, i) => (
            <i
              key={i}
              className={(i + 0.5) / WAVE.length <= p ? "on" : ""}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <b
          className="hdl"
          style={
            {
              left: `${p * 100}%`,
              "--sh": p < 0.08 ? "14px" : p > 0.92 ? "-14px" : "0px",
            } as React.CSSProperties
          }
        >
          <span className="pct">{share}%</span>
        </b>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calculadora de valor (quote por campaign_user)
// ---------------------------------------------------------------------------

function QuoteCalculator() {
  const [cuId, setCuId] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);

  const quoteQ = useInfluencerQuote(activeId);
  const autoReserve = useAutoReserve();

  const handleResolve = () => {
    const id = Number(cuId.trim());
    if (!Number.isInteger(id) || id <= 0) {
      toast.error("Informe um campaign_user_id inteiro positivo.");
      return;
    }
    setActiveId(id);
  };

  const handleAutoReserve = async () => {
    if (!activeId) return;
    try {
      const hold = await autoReserve.mutateAsync(activeId);
      toast.success(`Hold #${hold.id} criado: ${hold.amountFormatted} HYPE.`);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? "falha"}`);
    }
  };

  return (
    <section className="s2">
      <h3>Calculadora de valor</h3>
      <p className="s2-s" style={{ margin: "0 0 10px" }}>
        Veja quanto um criador receberia (informe o ID do campaign user).
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="number"
          placeholder="Ex.: 149"
          aria-label="Campaign User ID"
          value={cuId}
          onChange={(e) => setCuId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleResolve();
          }}
          style={{
            flex: 1,
            minWidth: 0,
            height: 54,
            border: 0,
            outline: 0,
            borderRadius: 18,
            background: "var(--bg)",
            padding: "0 16px",
            font: "inherit",
            fontSize: 14,
          }}
        />
        <button
          className="btn"
          onClick={handleResolve}
          disabled={!cuId.trim()}
        >
          Calcular
        </button>
      </div>

      {activeId && quoteQ.isLoading && (
        <p className="s2-s" style={{ marginTop: 10 }}>
          Calculando…
        </p>
      )}
      {activeId && quoteQ.error && (
        <p className="s2-s" style={{ marginTop: 10, color: "#dc2626" }}>
          Erro: {quoteQ.error.message}
        </p>
      )}
      {activeId && quoteQ.data && (
        <QuoteDisplay
          quote={quoteQ.data}
          onAutoReserve={handleAutoReserve}
          autoReservePending={autoReserve.isPending}
        />
      )}
    </section>
  );
}

function QuoteDisplay({
  quote,
  onAutoReserve,
  autoReservePending,
}: {
  quote: InfluencerQuote;
  onAutoReserve: () => void;
  autoReservePending: boolean;
}) {
  const isApproved = quote.status === "approved";
  const isFixed =
    quote.paymentMethod === "fixed" || quote.paymentMethod === "fixed_value";

  return (
    <div className="prres">
      <small>
        Receberia · user #{quote.userId} · cu #{quote.campaignUserId}
      </small>
      <b>
        {formatHype(quote.totalIncludedFormatted)} <span>{quote.currency}</span>
      </b>
      {quote.breakdown.map((row) => (
        <div
          key={row.stepNetworkId}
          className="s2d"
          style={{
            gridTemplateColumns: "1fr auto",
            border: 0,
            padding: "4px 0",
            opacity: row.included ? 1 : 0.45,
          }}
        >
          <span>
            {row.networkName} · {row.networkType}
          </span>
          <b>{formatHype(row.priceFormatted)}</b>
        </div>
      ))}
      <small style={{ marginTop: 6, display: "block" }}>
        Status {quote.status} · {quote.paymentMethod} · de até{" "}
        {formatHype(quote.totalAllFormatted)} {quote.currency} possíveis
      </small>

      {isApproved && isFixed && quote.totalIncludedWei !== "0" && (
        <button
          className="btn"
          style={{ width: "100%", marginTop: 12 }}
          onClick={onAutoReserve}
          disabled={autoReservePending}
        >
          {autoReservePending
            ? "Criando hold…"
            : `Criar hold de ${formatHype(quote.totalIncludedFormatted)} ${quote.currency}`}
        </button>
      )}
      {!isApproved && (
        <small style={{ marginTop: 8, display: "block" }}>
          Auto-reserve só está disponível para influencers em status approved.
        </small>
      )}
    </div>
  );
}
