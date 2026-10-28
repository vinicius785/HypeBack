import { useEffect, useRef, useState, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";
import {
  CAMPAIGN_SOCIAL_NETWORKS,
  getContentTypesForNetwork,
} from "@/shared/constants/campaign-formats";
import type { CampaignPhase, SocialFormat } from "@/shared/types";
import {
  formatDateForInput,
  getPhase1MinDate,
  getSubsequentPhaseMinDate,
  validatePhase1Date,
  validateSubsequentPhaseDate,
} from "@/shared/utils/date-validations";
import { currencyToNumber } from "@/shared/utils/masks";

import { Dropdown, FieldError, SectionCard, Toggle, ToggleRow, maskMoney } from "./fields";
import type { WizardStepProps } from "./types";

/** Valores reais aceitos pela API → rótulo/ícone do protótipo. */
const OBJS: Array<{ value: string; label: string; icon: string }> = [
  { value: "awareness", label: "Divulgação", icon: "mega" },
  { value: "reach", label: "Alcance", icon: "users" },
  { value: "engagement", label: "Relacionamento", icon: "heart" },
  { value: "conversion", label: "Conversão", icon: "trend" },
  { value: "education", label: "Educação", icon: "sparkles" },
];

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const USOS = [
  "Redes sociais da marca",
  "Anúncios pagos",
  "Site e e-commerce",
  "E-mail marketing",
  "Material impresso e PDV",
  "Imprensa e PR",
];

/** Prazo de uso da imagem → meses (campo imageRightsPeriod). "Sem prazo" = 999. */
const TEMPOS: Array<{ label: string; months: string }> = [
  { label: "30 dias", months: "1" },
  { label: "3 meses", months: "3" },
  { label: "6 meses", months: "6" },
  { label: "12 meses", months: "12" },
];

const p2 = (n: number) => String(n).padStart(2, "0");

const dFmt = (v: string) =>
  v ? `${+v.slice(8, 10)} ${MESES[+v.slice(5, 7) - 1].slice(0, 3).toLowerCase()} ${v.slice(0, 4)}` : "";

const money = (v: number) =>
  v ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "R$ 0";

function newPhase(id: string): CampaignPhase {
  return {
    id,
    objective: "",
    postDate: "",
    postTime: "18:00",
    includeImageRights: false,
    requiresProductReceipt: false,
    imageRightsPeriod: "",
    formats: [],
    files: "",
  };
}

/** Fecha o popover ao clicar fora do elemento referenciado. */
function useOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) cb.current();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return ref;
}

/* ───────────────────────── calendário ───────────────────────── */

function DatePick({
  value,
  min,
  bad,
  onChange,
}: {
  value: string;
  min?: string;
  bad: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const td = formatDateForInput(now);
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const ref = useOutside(open, () => setOpen(false));
  const lo = min && min > td ? min : td;

  const toggle = () => {
    if (!open) {
      setView(
        value
          ? { y: +value.slice(0, 4), m: +value.slice(5, 7) - 1 }
          : { y: now.getFullYear(), m: now.getMonth() },
      );
    }
    setOpen(!open);
  };
  const nav = (dir: number) =>
    setView(({ y, m }) => {
      const d = new Date(y, m + dir, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const { y, m } = view;
  const first = new Date(y, m, 1).getDay();
  const n = new Date(y, m + 1, 0).getDate();

  return (
    <div ref={ref} className={`n4c pkw ${bad ? "bad" : ""}`}>
      <label className="n4l">Data de postagem</label>
      <button type="button" className={`n4pk ${open ? "open" : ""}`} onClick={toggle}>
        <span className={value ? "" : "ph"}>{value ? dFmt(value) : "Escolher data"}</span>
        <I n="cal" cls="sm" />
      </button>
      {open ? (
        <div className="pkp cal pop">
          <div className="cal-h">
            <button type="button" aria-label="Mês anterior" onClick={() => nav(-1)}>
              <I n="chev" cls="sm" />
            </button>
            <b>
              {MESES[m]} {y}
            </b>
            <button type="button" aria-label="Próximo mês" onClick={() => nav(1)}>
              <I n="chev" cls="sm" />
            </button>
          </div>
          <div className="cal-w">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((x, k) => (
              <span key={k}>{x}</span>
            ))}
          </div>
          <div className="cal-g">
            {Array.from({ length: first }, (_, k) => (
              <i key={`b${k}`} />
            ))}
            {Array.from({ length: n }, (_, k) => {
              const v = `${y}-${p2(m + 1)}-${p2(k + 1)}`;
              return (
                <button
                  key={v}
                  type="button"
                  className={`cal-d ${v === value ? "sel" : ""} ${v === td ? "today" : ""}`}
                  disabled={v < lo}
                  onClick={() => pick(v)}
                >
                  {k + 1}
                </button>
              );
            })}
          </div>
          <div className="cal-f">
            <button type="button" disabled={td < lo} onClick={() => pick(td)}>
              Hoje
            </button>
            {value ? (
              <button type="button" onClick={() => pick("")}>
                Limpar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────── relógio ───────────────────────── */

const DL = { C: 88, Ro: 72, Ri: 46, B: 26 };

function TimePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"h" | "m">("h");
  const [draft, setDraft] = useState<{ h?: string; m?: string }>({});
  const ref = useOutside(open, () => setOpen(false));
  const angRef = useRef<number | null>(null);

  const [hh = "", mm = ""] = (value || "").split(":");

  const setPart = (part: "h" | "m", v: string) => {
    const h = part === "h" ? v : hh;
    const m = part === "m" ? v : mm;
    onChange(h || m ? `${h || "00"}:${m || "00"}` : "");
  };

  const { C, Ro, Ri, B } = DL;
  const pos = (idx: number, R: number): [number, number] => {
    const a = ((idx * 30 - 90) * Math.PI) / 180;
    return [C + R * Math.cos(a) - B / 2, C + R * Math.sin(a) - B / 2];
  };

  const val = mode === "h" ? hh : mm;
  let hand: ReactNode = null;
  if (val) {
    const target = mode === "h" ? (+hh % 12) * 30 : +mm * 6;
    const R = mode === "h" ? (+hh < 12 ? Ro : Ri) : Ro;
    const cur = angRef.current ?? target;
    const d = ((target - cur + 540) % 360) - 180;
    angRef.current = cur + d;
    hand = <i className="dl-h grow" style={{ height: R, transform: `rotate(${cur + d}deg)` }} />;
  } else {
    angRef.current = null;
  }

  const onInput = (part: "h" | "m", raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setDraft((d) => ({ ...d, [part]: digits }));
    if (digits.length === 2) {
      const max = part === "h" ? 23 : 59;
      const v = p2(Math.min(+digits, max));
      setPart(part, v);
      setDraft((d) => ({ ...d, [part]: undefined }));
      if (part === "h") setMode("m");
    }
  };
  const onBlur = (part: "h" | "m") => {
    const t = draft[part];
    if (t) setPart(part, p2(Math.min(+t, part === "h" ? 23 : 59)));
    setDraft((d) => ({ ...d, [part]: undefined }));
  };

  const dial: ReactNode[] = [];
  if (mode === "h") {
    for (let h = 0; h < 24; h++) {
      const [x, y] = pos(h % 12, h < 12 ? Ro : Ri);
      dial.push(
        <button
          key={h}
          type="button"
          className={`dl-n ${h >= 12 ? "in" : ""} ${hh === p2(h) ? "sel" : ""}`}
          style={{ left: x, top: y, ["--k" as string]: h % 12 }}
          onClick={() => {
            setPart("h", p2(h));
            setMode("m");
          }}
        >
          {p2(h)}
        </button>,
      );
    }
  } else {
    for (let k = 0; k < 12; k++) {
      const [x, y] = pos(k, Ro);
      dial.push(
        <button
          key={k}
          type="button"
          className={`dl-n ${mm === p2(k * 5) ? "sel" : ""}`}
          style={{ left: x, top: y, ["--k" as string]: k }}
          onClick={() => setPart("m", p2(k * 5))}
        >
          {p2(k * 5)}
        </button>,
      );
    }
  }

  return (
    <div ref={ref} className="n4c pkw">
      <label className="n4l">Horário</label>
      <button type="button" className={`n4pk ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <span className={value ? "" : "ph"}>{value || "Escolher hora"}</span>
        <I n="clock" cls="sm" />
      </button>
      {open ? (
        <div className="pkp tim pop">
          <div className="tim-d">
            <input
              className={`tin ${mode === "h" ? "on" : ""}`}
              inputMode="numeric"
              maxLength={2}
              placeholder="--"
              aria-label="Hora"
              autoComplete="off"
              value={draft.h ?? hh}
              onFocus={() => setMode("h")}
              onChange={(e) => onInput("h", e.target.value)}
              onBlur={() => onBlur("h")}
            />
            <span>:</span>
            <input
              className={`tin ${mode === "m" ? "on" : ""}`}
              inputMode="numeric"
              maxLength={2}
              placeholder="--"
              aria-label="Minutos"
              autoComplete="off"
              value={draft.m ?? mm}
              onFocus={() => setMode("m")}
              onChange={(e) => onInput("m", e.target.value)}
              onBlur={() => onBlur("m")}
            />
          </div>
          <div className="dl swap" key={mode}>
            {hand}
            <i className="dl-c" />
            {dial}
          </div>
          <div className="cal-f">
            <button type="button" onClick={() => onChange("")}>
              Limpar
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Pronto
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────── etapa ───────────────────────── */

export function StepPhases({ formData, updateFormData, tried }: WizardStepProps) {
  const phases: CampaignPhase[] = formData.phases?.length ? formData.phases : [newPhase("1")];
  const [open, setOpen] = useState(0);
  const [usos, setUsos] = useState<string[][]>([]);
  const [more, setMore] = useState(false);
  const [freshFmt, setFreshFmt] = useState<string | null>(null);
  const seen = useRef<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const sel = open < phases.length ? open : 0;
  const first = !seen.current.has(sel);
  useEffect(() => {
    seen.current.add(sel);
  }, [sel]);

  const commit = (next: CampaignPhase[]) => {
    updateFormData("phases", next);
    if (formData.phasesCount !== String(next.length)) {
      updateFormData("phasesCount", String(next.length));
    }
  };
  const patch = (i: number, changes: Partial<CampaignPhase>) =>
    commit(phases.map((p, k) => (k === i ? { ...p, ...changes } : p)));

  const addPhase = () => {
    if (phases.length >= 4) return;
    commit([...phases, newPhase(String(phases.length + 1))]);
    setOpen(phases.length);
    setMore(false);
  };
  const removePhase = (i: number) => {
    if (phases.length <= 1) return;
    commit(phases.filter((_, k) => k !== i).map((p, k) => ({ ...p, id: String(k + 1) })));
    setUsos((u) => u.filter((_, k) => k !== i));
    seen.current = new Set();
    setOpen((o) => Math.max(0, Math.min(o > i ? o - 1 : o, phases.length - 2)));
  };

  const minDate = (i: number): string | undefined =>
    i === 0 ? getPhase1MinDate() : getSubsequentPhaseMinDate(phases[i - 1]?.postDate ?? "");
  const dateError = (i: number): string | undefined => {
    const d = phases[i].postDate;
    if (!d) return undefined;
    if (i === 0) return validatePhase1Date(d).error;
    const prev = phases[i - 1]?.postDate;
    return prev ? validateSubsequentPhaseDate(d, prev).error : undefined;
  };
  const fmtIncomplete = (f: SocialFormat) =>
    !f.socialNetwork || !f.contentType || !(parseInt(f.quantity || "0", 10) >= 1);
  const needsPrice = formData.paymentType === "fixed";
  const priceMissing = (f: SocialFormat) => needsPrice && !(currencyToNumber(f.price || "") > 0);
  const rightsMissing = (p: CampaignPhase) =>
    p.includeImageRights !== false && !(parseInt(p.imageRightsPeriod || "0", 10) >= 1);
  const problem = (i: number) => {
    const p = phases[i];
    return (
      !p.objective ||
      !p.postDate ||
      !!dateError(i) ||
      !p.formats?.length ||
      p.formats.some((f) => fmtIncomplete(f) || priceMissing(f)) ||
      rightsMissing(p)
    );
  };

  const p = phases[sel];
  const i = sel;
  const fmts = p.formats ?? [];
  const rightsOn = p.includeImageRights !== false;
  const usosSel = usos[i] ?? [];
  const nq = fmts.reduce((a, f) => a + (parseInt(f.quantity || "0", 10) || 0), 0);
  const tot = fmts.reduce((a, f) => a + currencyToNumber(f.price || ""), 0);
  const dErr = dateError(i);

  const setFmt = (j: number, changes: Partial<SocialFormat>) =>
    patch(i, { formats: fmts.map((f, k) => (k === j ? { ...f, ...changes } : f)) });
  const addFmt = () => {
    const id = `${Date.now()}`;
    setFreshFmt(id);
    patch(i, {
      formats: [
        ...fmts,
        {
          id,
          socialNetwork: "instagram",
          contentType: getContentTypesForNetwork("instagram")[0]?.value ?? "",
          quantity: "1",
        },
      ],
    });
  };

  const cols = needsPrice
    ? undefined
    : { gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr) 86px 34px" };

  return (
    <>
      <div className="n4row">
        {phases.map((ph, k) => {
          const bad = tried && problem(k);
          const ok = !!ph.objective && !!ph.postDate && !problem(k);
          const obj = OBJS.find((o) => o.value === ph.objective)?.label ?? (ph.objective || "Definir objetivo");
          return (
            <button
              key={k}
              type="button"
              className={`n4t ${sel === k ? "open" : ""} ${bad ? "bad" : ""} ${ok ? "ok" : ""}`}
              aria-expanded={sel === k}
              onClick={() => {
                setOpen(k);
                setMore(false);
              }}
            >
              <span className="pn">{k + 1}</span>
              <b>Fase {k + 1}</b>
              <small>
                {obj}
                {ph.postDate ? ` · ${ph.postDate.split("-").reverse().slice(0, 2).join("/")}` : ""}
              </small>
              {phases.length > 1 ? (
                <span
                  className="rmx"
                  role="button"
                  aria-label="Remover fase"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhase(k);
                  }}
                >
                  <I n="trash" cls="sm" />
                </span>
              ) : null}
            </button>
          );
        })}
        {phases.length < 4 ? (
          <button type="button" className="n4t add" onClick={addPhase}>
            <span className="pn">
              <I n="plus" cls="sm" />
            </span>
            <b>Adicionar fase</b>
            <small>Até 4 fases</small>
          </button>
        ) : null}
      </div>

      <SectionCard
        icon={<I n="cal" />}
        title={`Fase ${i + 1}`}
        sub="Objetivo, data e formatos de conteúdo"
        className={`n4p ${first ? "go" : ""}`}
      >
        <div className="n4s" style={{ ["--k" as string]: 0 }}>
          <label className="n4l">Objetivo da fase</label>
          <div
            className={`n4o ${tried && !p.objective ? "bad" : ""}`}
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
          >
            {OBJS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`n4oc ${p.objective === o.value ? "on" : ""}`}
                aria-pressed={p.objective === o.value}
                onClick={() => patch(i, { objective: o.value })}
              >
                <span>
                  <I n={o.icon} cls="sm" />
                </span>
                {o.label}
              </button>
            ))}
          </div>
          <FieldError show={tried && !p.objective}>Escolha o objetivo da fase</FieldError>
        </div>

        <div className="n4g n4s" style={{ ["--k" as string]: 1 }}>
          <DatePick
            value={p.postDate}
            min={minDate(i)}
            bad={(tried && !p.postDate) || !!dErr}
            onChange={(v) => patch(i, { postDate: v })}
          />
          <TimePick value={p.postTime ?? ""} onChange={(v) => patch(i, { postTime: v })} />
          <div className="n4c">
            <label className="n4l">Direitos de imagem</label>
            <div className="n4sw">
              <span>Permitir reuso</span>
              <Toggle
                on={rightsOn}
                label="Direitos de uso de imagem"
                onChange={(v) =>
                  patch(i, v ? { includeImageRights: true } : { includeImageRights: false, imageRightsPeriod: "" })
                }
              />
            </div>
          </div>
        </div>
        <FieldError show={!!dErr || (tried && !p.postDate)}>{dErr ?? "Escolha a data de postagem"}</FieldError>

        {rightsOn ? (
          <div className="n4rt fin">
            <div className="n4rg">
              <label className="n4l">Onde a imagem do influenciador será usada?</label>
              <div className="nchips">
                {USOS.map((u) => {
                  const on = usosSel.includes(u);
                  return (
                    <button
                      key={u}
                      type="button"
                      className={`nch ${on ? "on" : ""}`}
                      aria-pressed={on}
                      onClick={() =>
                        setUsos((all) => {
                          const next = [...all];
                          const cur = next[i] ?? [];
                          next[i] = on ? cur.filter((x) => x !== u) : [...cur, u];
                          return next;
                        })
                      }
                    >
                      {on ? <I n="check" cls="sm" /> : null}
                      {u}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="n4rg">
              <label className="n4l">Por quanto tempo a imagem poderá ser usada?</label>
              <div className={`n4tm ${tried && rightsMissing(p) ? "bad" : ""}`}>
                {TEMPOS.map((t) => {
                  const on = (p.imageRightsPeriod ?? "").trim() === t.months;
                  return (
                    <button
                      key={t.months}
                      type="button"
                      className={on ? "on" : ""}
                      aria-pressed={on}
                      onClick={() => patch(i, { imageRightsPeriod: t.months })}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <FieldError show={tried && rightsMissing(p)}>Informe o prazo de liberação</FieldError>
            </div>
          </div>
        ) : null}

        <div className="n4f n4s" style={{ ["--k" as string]: 2 }}>
          <div className="n4fh">
            <div>
              <b>Formatos</b>
              <small>{needsPrice ? "O valor é do pacote, não por unidade" : "Redes e conteúdos desta fase"}</small>
            </div>
            <button type="button" className="nbtn" onClick={addFmt}>
              <I n="plus" cls="sm" />
              Adicionar formato
            </button>
          </div>
          {fmts.length ? (
            <div className="nfm nfh" style={cols}>
              <span>Rede</span>
              <span>Conteúdo</span>
              <span>Qtd.</span>
              {needsPrice ? <span>Valor do pacote</span> : null}
            </div>
          ) : null}
          {fmts.map((f, j) => {
            const last = needsPrice ? null : (
              <button type="button" className="nfm-x" aria-label="Remover formato" onClick={() => patch(i, { formats: fmts.filter((_, k) => k !== j) })}>
                <I n="x" cls="sm" />
              </button>
            );
            return (
              <div key={f.id} className={`nfm ${freshFmt === f.id ? "fin" : ""}`} style={cols}>
                <div className="nfm-c">
                  <Dropdown
                    value={f.socialNetwork}
                    options={CAMPAIGN_SOCIAL_NETWORKS}
                    placeholder="Rede"
                    onChange={(v) =>
                      setFmt(j, {
                        socialNetwork: v,
                        contentType: getContentTypesForNetwork(v)[0]?.value ?? "",
                      })
                    }
                  />
                </div>
                <div className="nfm-c">
                  <Dropdown
                    value={f.contentType}
                    options={getContentTypesForNetwork(f.socialNetwork)}
                    placeholder="Conteúdo"
                    onChange={(v) => setFmt(j, { contentType: v })}
                  />
                </div>
                <input
                  className="ni nfm-q"
                  inputMode="numeric"
                  placeholder="1"
                  aria-label="Quantidade"
                  autoComplete="off"
                  value={f.quantity ?? ""}
                  onChange={(e) => setFmt(j, { quantity: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                />
                {needsPrice ? (
                  <div className="nmn nfm-v">
                    <span>R$</span>
                    <input
                      className="ni"
                      inputMode="numeric"
                      placeholder="0,00"
                      aria-label="Valor do pacote"
                      autoComplete="off"
                      value={f.price ?? ""}
                      onChange={(e) => setFmt(j, { price: maskMoney(e.target.value) })}
                    />
                    <button type="button" className="nfm-x" aria-label="Remover formato" onClick={() => patch(i, { formats: fmts.filter((_, k) => k !== j) })}>
                      <I n="x" cls="sm" />
                    </button>
                  </div>
                ) : (
                  last
                )}
              </div>
            );
          })}
          <FieldError show={tried && !fmts.length}>Adicione ao menos um formato</FieldError>
          <FieldError show={tried && fmts.some((f) => fmtIncomplete(f))}>
            Preencha rede, conteúdo e quantidade de cada formato
          </FieldError>
          <FieldError show={tried && fmts.some((f) => !fmtIncomplete(f) && priceMissing(f))}>
            Informe o valor de cada formato
          </FieldError>
          <div className="n4tt">
            <span>
              {nq} {nq === 1 ? "conteúdo" : "conteúdos"} nesta fase
            </span>
            {needsPrice ? <b>{money(tot)}</b> : null}
          </div>
        </div>

        <div className="n4s" style={{ ["--k" as string]: 3 }}>
          <button type="button" className="nbtn" aria-expanded={more} onClick={() => setMore((m) => !m)}>
            <I n="gear" cls="sm" />
            Mais opções da fase
          </button>
          {more ? (
            <div className="n4g" style={{ marginTop: 14 }}>
              <div className="n4c">
                <label className="n4l">Hashtag da fase (opcional)</label>
                <input
                  className="ni"
                  placeholder="#minhacampanha"
                  autoComplete="off"
                  value={p.hashtag ?? ""}
                  onChange={(e) => patch(i, { hashtag: e.target.value })}
                />
              </div>
              <div className="n4c">
                <label className="n4l">Prazo para envio do conteúdo</label>
                <input
                  className="ni"
                  type="date"
                  value={p.contentSubmissionDeadline ?? ""}
                  onChange={(e) => patch(i, { contentSubmissionDeadline: e.target.value })}
                />
              </div>
              <div className="n4c">
                <label className="n4l">Prazo para correção</label>
                <input
                  className="ni"
                  type="date"
                  value={p.correctionSubmissionDeadline ?? ""}
                  onChange={(e) => patch(i, { correctionSubmissionDeadline: e.target.value })}
                />
              </div>
              <div className="n4c">
                <label className="n4l">Arquivos da fase (opcional)</label>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  hidden
                  onChange={(e) => {
                    const fl = e.target.files;
                    if (fl?.length) patch(i, { files: fl[0].name });
                  }}
                />
                <button type="button" className="nbtn" onClick={() => fileRef.current?.click()}>
                  <I n="paperclip" cls="sm" />
                  {p.files || "Fazer upload de arquivos"}
                </button>
              </div>
              {formData.paymentType === "swap" ? (
                <div className="n4c" style={{ gridColumn: "1 / -1" }}>
                  <ToggleRow
                    on={p.requiresProductReceipt === true}
                    onChange={(v) => patch(i, { requiresProductReceipt: v })}
                    label="Exigir confirmação de recebimento nesta fase"
                    sub="O conteúdo só poderá ser enviado depois que o influenciador confirmar que recebeu o produto."
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </>
  );
}
