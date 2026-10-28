import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import { validateLiveThumbnailFile } from "@/shared/services/lives";

const TITLE_MAX = 150;
const DESC_MAX = 2000;
const HOST_MAX = 80;

const STEPS: [string, string][] = [
  ["Detalhes", "Capa, título e descrição"],
  ["Quando", "Data e horário"],
];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WD = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];
const pad = (n: number) => String(n).padStart(2, "0");
const SLOTS: string[] = (() => {
  const sl: string[] = [];
  for (let h = 9; h <= 21; h++) {
    sl.push(`${pad(h)}:00`);
    if (h < 21) sl.push(`${pad(h)}:30`);
  }
  sl.push("21:30");
  return sl;
})();

export interface LiveFormSubmit {
  title: string;
  description: string | null;
  host_display_name: string | null;
  /** ISO 8601. "Transmitir agora" envia o instante atual. */
  scheduled_at: string;
}

interface LiveFormProps {
  initial?: {
    title?: string;
    description?: string | null;
    host_display_name?: string | null;
    scheduled_at?: string | null;
  };
  /** URL já resolvida da thumbnail atual (modo edição). */
  initialThumbnailUrl?: string | null;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: LiveFormSubmit, thumbnailFile: File | null) => void;
  onCancel?: () => void;
}

function splitIso(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "18:00" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "18:00" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function LiveForm({
  initial,
  initialThumbnailUrl,
  submitLabel,
  submittingLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: LiveFormProps) {
  const initialSplit = splitIso(initial?.scheduled_at);
  // Considera "agendada" se a data estiver a mais de 2min no futuro.
  const initialScheduled =
    !!initial?.scheduled_at &&
    new Date(initial.scheduled_at).getTime() > Date.now() + 2 * 60 * 1000;

  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [host, setHost] = useState(initial?.host_display_name ?? "");
  const [mode, setMode] = useState<"now" | "schedule">(
    initialScheduled ? "schedule" : "now",
  );
  const [scheduledDate, setScheduledDate] = useState(initialSplit.date);
  const [scheduledTime, setScheduledTime] = useState(initialSplit.time);
  const [cal, setCal] = useState(() => {
    const d = initialSplit.date ? new Date(`${initialSplit.date}T12:00:00`) : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  // Upload deferido: guardamos o File; o screen envia em /uploads antes de salvar.
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(
    initialThumbnailUrl ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!onCancel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, isSubmitting]);

  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Título obrigatório";
    else if (title.length > TITLE_MAX) e.title = `Máx ${TITLE_MAX} caracteres`;
    if (description.length > DESC_MAX) e.description = `Máx ${DESC_MAX} caracteres`;
    if (host.length > HOST_MAX) e.host = `Máx ${HOST_MAX} caracteres`;
    if (mode === "schedule" && !scheduledDate) {
      e.schedule = "Informe a data do agendamento";
    }
    return e;
  }, [title, description, host, mode, scheduledDate]);

  const step0Bad = !!(errors.title || errors.description || errors.host);
  const hasErrors = Object.keys(errors).length > 0;

  const handlePickThumb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateLiveThumbnailFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
  };

  const removeThumb = () => {
    setThumbFile(null);
    setThumbPreview(null);
  };

  const buildScheduledAt = (): string => {
    if (mode === "now") return new Date().toISOString();
    return new Date(
      `${scheduledDate}T${scheduledTime || "00:00"}:00`,
    ).toISOString();
  };

  const goNext = () => {
    if (step0Bad) {
      setTried(true);
      toast.error("Corrija os campos destacados antes de continuar.");
      return;
    }
    setStep(1);
  };

  const handleSubmit = () => {
    if (hasErrors) {
      setTried(true);
      if (step0Bad) setStep(0);
      toast.error("Corrija os campos destacados antes de continuar.");
      return;
    }
    const scheduledAt = buildScheduledAt();
    if (mode === "schedule" && new Date(scheduledAt).getTime() < Date.now()) {
      toast.error("A data/hora do agendamento deve estar no futuro.");
      return;
    }
    onSubmit(
      {
        title: title.trim(),
        description: description.trim() || null,
        host_display_name: host.trim() || null,
        scheduled_at: scheduledAt,
      },
      thumbFile,
    );
  };

  const [hh, mm] = (scheduledTime || "00:00").split(":");
  const setHM = (h: string, m: string) =>
    setScheduledTime(`${h.padStart(2, "0")}:${m.padStart(2, "0")}`);

  const renderCal = () => {
    const { y, m } = cal;
    const first = new Date(y, m, 1).getDay();
    const n = new Date(y, m + 1, 0).getDate();
    const nav = (d: number) => {
      const t = new Date(y, m + d, 1);
      setCal({ y: t.getFullYear(), m: t.getMonth() });
    };
    return (
      <div className="lvf-cal">
        <div className="cal-h">
          <button type="button" onClick={() => nav(-1)} aria-label="Mês anterior">
            <I n="chev" cls="sm" />
          </button>
          <b>
            {MESES[m]} {y}
          </b>
          <button type="button" onClick={() => nav(1)} aria-label="Próximo mês">
            <I n="chev" cls="sm" />
          </button>
        </div>
        <div className="cal-w">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </div>
        <div className="cal-g">
          {Array.from({ length: first }, (_, i) => (
            <i key={`e${i}`} />
          ))}
          {Array.from({ length: n }, (_, k) => {
            const v = `${y}-${pad(m + 1)}-${pad(k + 1)}`;
            return (
              <button
                key={v}
                type="button"
                className={`cal-d ${v === scheduledDate ? "sel" : ""} ${v === todayIso ? "today" : ""}`}
                disabled={v < todayIso}
                onClick={() => setScheduledDate(v)}
              >
                {k + 1}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDetails = () => (
    <div className="lvf-s0">
      <div className="lvf-cvc">
        <label className="n4l">Capa da live</label>
        {thumbPreview ? (
          <div className="lvf-cv">
            <img src={thumbPreview} alt="Pré-visualização da capa" />
            <div className="lvf-cva">
              <button type="button" className="nbtn" onClick={() => fileInputRef.current?.click()}>
                <I n="image" cls="sm" />
                Trocar
              </button>
              <button type="button" className="nbtn" onClick={removeThumb} aria-label="Remover">
                <I n="trash" cls="sm" />
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="lvf-dz" onClick={() => fileInputRef.current?.click()}>
            <span>
              <I n="image" />
            </span>
            <b>Enviar capa</b>
            <small>JPEG, PNG ou WebP · até 5 MB</small>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePickThumb}
          hidden
        />
      </div>
      <div className="lvf-fc">
        <div className={`n4c ${tried && errors.title ? "bad" : ""}`}>
          <label className="n4l">Título</label>
          <input
            className="cm-in"
            maxLength={TITLE_MAX + 1}
            placeholder="Ex.: Bate-papo com criadores"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
          />
          {tried && errors.title ? <small className="nfe">{errors.title}</small> : null}
          <small className="lvf-ct">
            {title.length}/{TITLE_MAX}
          </small>
        </div>
        <div className="n4c">
          <label className="n4l">
            Descrição <em>opcional</em>
          </label>
          <textarea
            className="cm-ta"
            rows={4}
            maxLength={DESC_MAX + 1}
            placeholder="Conte aos usuários do que se trata a transmissão."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {tried && errors.description ? (
            <small className="nfe">{errors.description}</small>
          ) : null}
          <small className="lvf-ct">
            {description.length}/{DESC_MAX}
          </small>
        </div>
        <div className="n4c">
          <label className="n4l">
            Nome de exibição <em>opcional</em>
          </label>
          <input
            className="cm-in"
            maxLength={HOST_MAX + 1}
            placeholder="Como aparece no app (padrão: nome do workspace)"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            autoComplete="off"
          />
          {tried && errors.host ? <small className="nfe">{errors.host}</small> : null}
        </div>
      </div>
    </div>
  );

  const renderWhen = () => {
    const dt = scheduledDate ? new Date(`${scheduledDate}T12:00:00`) : null;
    return (
      <>
        <div className="n4tm lvf-wt">
          <button type="button" className={mode === "now" ? "on" : ""} onClick={() => setMode("now")}>
            <I n="video" cls="sm" />
            Transmitir agora
          </button>
          <button
            type="button"
            className={mode === "schedule" ? "on" : ""}
            onClick={() => setMode("schedule")}
          >
            <I n="cal" cls="sm" />
            Agendar para depois
          </button>
        </div>
        {mode === "schedule" ? (
          <div className="lvq">
            <div className="lvq-l">{renderCal()}</div>
            <div className="lvq-r">
              <div className="lvq-h">
                <b>
                  {dt
                    ? `${WD[dt.getDay()]}, ${dt.getDate()} de ${MESES[dt.getMonth()].toLowerCase()}`
                    : "Escolha a data"}
                </b>
                <small>Escolha o horário</small>
              </div>
              {tried && errors.schedule ? <small className="nfe">{errors.schedule}</small> : null}
              <div className="lvq-tl">
                {SLOTS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={scheduledTime === t ? "on" : ""}
                    onClick={() => setScheduledTime(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="lvq-c">
                <span>Outro horário</span>
                <div className="lvf-ti">
                  <input
                    inputMode="numeric"
                    maxLength={2}
                    value={hh}
                    aria-label="Hora"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setHM(String(Math.min(23, Number(v || 0))), mm);
                    }}
                  />
                  <i>:</i>
                  <input
                    inputMode="numeric"
                    maxLength={2}
                    value={mm}
                    aria-label="Minutos"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setHM(hh, String(Math.min(59, Number(v || 0))));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="lvq-now">
            <span>
              <I n="video" />
            </span>
            <b>Você entra no estúdio assim que criar</b>
            <small>Cria a live pronta para você iniciar já pela sala de controle.</small>
          </div>
        )}
      </>
    );
  };

  const last = step === STEPS.length - 1;

  return createPortal(
    <div className="pv">
      <div className="ovb on" onClick={() => !isSubmitting && onCancel?.()} />
      <div className="ovw">
        <section className="ovd on wide lvfm" role="dialog" aria-label="Live">
          <div className="sh-h cm-h">
            <div>
              <small>{initial ? "Editar" : "Nova live"}</small>
              <h2>{initial ? "Editar live" : "Criar live"}</h2>
            </div>
            {onCancel ? (
              <button type="button" className="round" onClick={onCancel} aria-label="Fechar">
                <I n="x" cls="sm" />
              </button>
            ) : null}
          </div>
          <div
            className="sh-seg lvf-sg"
            style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}
          >
            {STEPS.map(([t], k) => (
              <button
                key={t}
                type="button"
                className={`${step === k ? "on" : ""} ${k < step ? "dn" : ""}`}
                onClick={() => {
                  if (k > step && step0Bad) {
                    setTried(true);
                    return;
                  }
                  setStep(k);
                }}
              >
                <span>{k < step ? <I n="check" cls="sm" /> : k + 1}</span>
                {t}
              </button>
            ))}
          </div>
          <div className="lvf-bd swp" key={step}>
            {step === 0 ? renderDetails() : renderWhen()}
          </div>
          <div className="cm-f">
            {step ? (
              <button type="button" className="btn out" onClick={() => setStep(step - 1)}>
                <I n="back" cls="sm" />
                Voltar
              </button>
            ) : (
              <small>{STEPS[0][1]}</small>
            )}
            <span style={{ flex: 1 }} />
            {last ? (
              <button
                type="button"
                className="btn"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                <I n={mode === "now" ? "video" : "check"} cls="sm" />
                {isSubmitting ? submittingLabel : submitLabel}
              </button>
            ) : (
              <button type="button" className="btn" onClick={goNext}>
                Continuar
                <I n="chev" cls="sm" />
              </button>
            )}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
