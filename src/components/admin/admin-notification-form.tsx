import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import {
  AdminAudienceBuilder,
  audienceError,
  isAudienceValid,
} from "@/components/admin/admin-audience-builder";
import {
  AdminNotificationPreview,
  CHANNEL_LABEL,
} from "@/components/admin/admin-notification-preview";
import {
  useCreateAdminNotification,
  useEstimateAdminAudience,
} from "@/hooks/use-admin-notifications";
import type {
  AdminAudienceEstimate,
  AdminAudienceFilter,
  AdminNotificationChannel,
  AdminNotificationCreatePayload,
} from "@/shared/types";

const TITLE_MAX = 65;
const BODY_MAX = 240;

const STEPS: [string, string][] = [
  ["Mensagem", "O que os criadores vão ler"],
  ["Destino", "Quem recebe e por onde"],
  ["Envio", "Quando enviar"],
];

const CHANNELS: Array<[AdminNotificationChannel, string]> = [
  ["push", "Aparece no celular dos criadores"],
  ["email", "Vai para o e-mail cadastrado"],
  ["whatsapp", "Só funciona com modelo aprovado"],
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
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const SLOTS: string[] = (() => {
  const sl: string[] = [];
  for (let h = 9; h <= 21; h++) {
    sl.push(`${pad(h)}:00`);
    if (h < 21) sl.push(`${pad(h)}:30`);
  }
  return sl;
})();

function validateUrl(url: string): boolean {
  if (!url) return true;
  return /^https?:\/\/.+/i.test(url) || /^[a-z][a-z0-9+\-.]*:\/\/.+/i.test(url);
}

export interface AdminNotificationInitial {
  title: string;
  body: string;
  ctaUrl: string;
  channels: AdminNotificationChannel[];
  audience: AdminAudienceFilter;
}

interface AdminNotificationFormProps {
  initial?: AdminNotificationInitial;
  onClose: () => void;
}

export function AdminNotificationForm({
  initial,
  onClose,
}: AdminNotificationFormProps) {
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [ctaUrl, setCtaUrl] = useState(initial?.ctaUrl ?? "");
  const [channels, setChannels] = useState<AdminNotificationChannel[]>(
    initial?.channels ?? ["push"],
  );
  const [audience, setAudience] = useState<AdminAudienceFilter>(
    initial?.audience ?? { type: "all" },
  );
  const [when, setWhen] = useState<"now" | "sched">("now");
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);
  const todayIso = useMemo(() => isoOf(new Date()), []);
  const [date, setDate] = useState(isoOf(tomorrow));
  const [time, setTime] = useState("10:00");
  const [cal, setCal] = useState({
    y: tomorrow.getFullYear(),
    m: tomorrow.getMonth(),
  });

  const estimateMutation = useEstimateAdminAudience();
  const createMutation = useCreateAdminNotification();
  const sending = createMutation.isPending;

  // Alcance real: recalcula sozinho (com debounce) quando o público muda.
  const [estimate, setEstimate] = useState<AdminAudienceEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estFailed, setEstFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const reqRef = useRef(0);
  const audienceKey = JSON.stringify(audience);
  const audienceOk = isAudienceValid(audience);
  const estimateAsync = estimateMutation.mutateAsync;

  useEffect(() => {
    const id = ++reqRef.current;
    setEstimate(null);
    setEstFailed(false);
    if (!audienceOk) {
      setEstimating(false);
      return;
    }
    setEstimating(true);
    const t = setTimeout(async () => {
      try {
        const r = await estimateAsync(JSON.parse(audienceKey));
        if (id === reqRef.current) setEstimate(r);
      } catch {
        if (id === reqRef.current) setEstFailed(true);
      } finally {
        if (id === reqRef.current) setEstimating(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [audienceKey, audienceOk, estimateAsync, retry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const reach = estimate?.total_recipients ?? 0;
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  const reachLabel = estimate ? `${fmt(reach)} criadores` : null;
  const urlBad = !validateUrl(ctaUrl.trim());

  const step0Ok = !!title.trim() && !!body.trim() && !urlBad;
  const step1Err = audienceError(audience);
  const step1Ok = !step1Err && channels.length > 0 && !!estimate && reach > 0;

  const whenLabel =
    when === "now"
      ? "Assim que confirmar"
      : (() => {
          const d = new Date(`${date}T12:00:00`);
          return `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}, ${time}`;
        })();

  const go = (k: number) => {
    setStep(k);
    setTried(false);
  };

  const next = () => {
    if (step === 0 && !step0Ok) return setTried(true);
    if (step === 1 && !step1Ok) {
      setTried(true);
      if (estimating) toast.error("Aguarde o cálculo do alcance.");
      return;
    }
    go(step + 1);
  };

  const save = async () => {
    const scheduledAt =
      when === "sched" ? new Date(`${date}T${time || "00:00"}:00`) : null;
    if (scheduledAt && scheduledAt.getTime() < Date.now()) {
      toast.error("A data/hora do agendamento deve estar no futuro.");
      return;
    }
    const payload: AdminNotificationCreatePayload = {
      title: title.trim(),
      body: body.trim(),
      cta_url: ctaUrl.trim() || null,
      channels,
      audience,
      scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
    };
    try {
      await createMutation.mutateAsync(payload);
      toast.success(
        when === "now" ? "Notificação enviada para a fila." : "Envio agendado.",
      );
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível criar a notificação.",
      );
    }
  };

  const toggleChannel = (ch: AdminNotificationChannel) =>
    setChannels((c) => (c.includes(ch) ? c.filter((x) => x !== ch) : [...c, ch]));

  const navCal = (d: number) => {
    const t = new Date(cal.y, cal.m + d, 1);
    setCal({ y: t.getFullYear(), m: t.getMonth() });
  };

  const renderCal = () => {
    const { y, m } = cal;
    const first = new Date(y, m, 1).getDay();
    const n = new Date(y, m + 1, 0).getDate();
    return (
      <div className="lvf-cal">
        <div className="cal-h">
          <button type="button" onClick={() => navCal(-1)} aria-label="Mês anterior">
            <I n="chev" cls="sm" />
          </button>
          <b>
            {MESES[m]} {y}
          </b>
          <button type="button" onClick={() => navCal(1)} aria-label="Próximo mês">
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
                className={`cal-d ${v === date ? "sel" : ""} ${v === todayIso ? "today" : ""}`}
                disabled={v < todayIso}
                onClick={() => setDate(v)}
              >
                {k + 1}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const stepBody = () => {
    if (step === 0) {
      return (
        <>
          <div className={`n4c ${tried && !title.trim() ? "bad" : ""}`}>
            <label className="n4l">Título</label>
            <input
              className="cm-in"
              maxLength={TITLE_MAX}
              placeholder="Ex.: Nova campanha aberta para você!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
            />
            <small className="lvf-ct">
              {title.length}/{TITLE_MAX}
            </small>
            {tried && !title.trim() ? <small className="nfe">Escreva um título</small> : null}
          </div>
          <div className={`n4c ${tried && !body.trim() ? "bad" : ""}`}>
            <label className="n4l">Mensagem</label>
            <textarea
              className="cm-ta"
              rows={4}
              maxLength={BODY_MAX}
              placeholder="Escreva o que os criadores vão ler."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <small className="lvf-ct">
              {body.length}/{BODY_MAX}
            </small>
            {tried && !body.trim() ? <small className="nfe">Escreva a mensagem</small> : null}
          </div>
          <div className={`n4c ${tried && urlBad ? "bad" : ""}`}>
            <label className="n4l">
              Link ao tocar <em>opcional</em>
            </label>
            <input
              className="cm-in"
              placeholder="https://… ou hypeapp://campanha/123"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              autoComplete="off"
            />
            {tried && urlBad ? (
              <small className="nfe">URL inválida — use http(s):// ou esquema com ://</small>
            ) : null}
          </div>
        </>
      );
    }
    if (step === 1) {
      const bad = tried && !step1Ok;
      return (
        <>
          <AdminAudienceBuilder value={audience} onChange={setAudience} />
          <div
            className={`lvq-now ntw-rc ${reach ? "" : "z"} ${bad && !estimating ? "bad" : ""}`}
          >
            <span>
              <I n="users" />
            </span>
            <b>
              {estimating
                ? "Calculando…"
                : estimate
                  ? `${fmt(reach)} criadores`
                  : "Nenhum criador ainda"}
            </b>
            <small>
              {estimating
                ? "Buscando o alcance do público escolhido"
                : estFailed
                  ? "Não foi possível calcular o alcance."
                  : estimate
                    ? reach
                      ? "vão receber esta notificação" +
                        (Object.keys(estimate.by_channel).length
                          ? " · " +
                            Object.entries(estimate.by_channel)
                              .map(
                                ([c, n]) =>
                                  `${CHANNEL_LABEL[c as AdminNotificationChannel]}: ${fmt(n ?? 0)}`,
                              )
                              .join(" · ")
                          : "")
                      : "Nenhum criador neste público. Ajuste os filtros."
                    : (step1Err ?? "Escolha um filtro acima para ver o alcance")}
            </small>
            {estFailed ? (
              <button
                type="button"
                className="btn out"
                style={{ marginLeft: "auto" }}
                onClick={() => setRetry((r) => r + 1)}
              >
                <I n="refresh" cls="sm" />
                Tentar de novo
              </button>
            ) : null}
          </div>
          <div className={`sh-c lvt-op ${tried && !channels.length ? "ntw-bad" : ""}`}>
            <h4>Onde enviar</h4>
            {CHANNELS.map(([k, sub]) => (
              <div className="lvf-sw" key={k}>
                <div>
                  <b>{CHANNEL_LABEL[k]}</b>
                  <small>{sub}</small>
                </div>
                <button
                  type="button"
                  className={`tgl ${channels.includes(k) ? "on" : ""}`}
                  role="switch"
                  aria-checked={channels.includes(k)}
                  aria-label={CHANNEL_LABEL[k]}
                  onClick={() => toggleChannel(k)}
                >
                  <i />
                </button>
              </div>
            ))}
            {tried && !channels.length ? (
              <small className="nfe">Escolha ao menos um canal</small>
            ) : null}
          </div>
        </>
      );
    }
    const dt = new Date(`${date}T12:00:00`);
    return (
      <>
        <div className="n4tm lvf-wt">
          <button type="button" className={when === "now" ? "on" : ""} onClick={() => setWhen("now")}>
            <I n="send" cls="sm" />
            Enviar agora
          </button>
          <button type="button" className={when === "sched" ? "on" : ""} onClick={() => setWhen("sched")}>
            <I n="cal" cls="sm" />
            Agendar para depois
          </button>
        </div>
        {when === "sched" ? (
          <div className="lvq">
            <div className="lvq-l">{renderCal()}</div>
            <div className="lvq-r">
              <div className="lvq-h">
                <b>
                  {WD[dt.getDay()]}, {dt.getDate()} de {MESES[dt.getMonth()].toLowerCase()}
                </b>
                <small>Escolha o horário</small>
              </div>
              <div className="lvq-tl">
                {SLOTS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={time === t ? "on" : ""}
                    onClick={() => setTime(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="lvq-now">
            <span>
              <I n="send" />
            </span>
            <b>Sai assim que você confirmar</b>
            <small>Os criadores recebem na hora, nos canais escolhidos.</small>
          </div>
        )}
      </>
    );
  };

  const last = step === STEPS.length - 1;

  return createPortal(
    <div className="pv">
      <div className="ovb on" onClick={() => !sending && onClose()} />
      <div className="ovw">
        <section
          className="ovd on wide lvfm ntm ntw"
          role="dialog"
          aria-label="Nova notificação"
        >
          <div className="sh-h cm-h">
            <div>
              <small>Notificações</small>
              <h2>Nova notificação</h2>
            </div>
            <button type="button" className="round" onClick={onClose} aria-label="Fechar">
              <I n="x" cls="sm" />
            </button>
          </div>
          <div className="ntw-w">
            <div
              className="sh-seg lvf-sg"
              style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}
            >
              {STEPS.map(([t], k) => (
                <button
                  key={t}
                  type="button"
                  className={`${step === k ? "on" : ""} ${k < step ? "dn" : ""}`}
                  onClick={() => k < step && go(k)}
                >
                  <span>{k < step ? <I n="check" cls="sm" /> : k + 1}</span>
                  {t}
                </button>
              ))}
            </div>
            <div className="ntw-m">
              <div className="lvf-bd swp" key={step}>
                {stepBody()}
              </div>
              <aside className="ntw-pv">
                <AdminNotificationPreview
                  title={title}
                  body={body}
                  ctaUrl={ctaUrl.trim() || undefined}
                  channels={channels}
                  reach={reachLabel}
                  when={whenLabel}
                />
              </aside>
            </div>
          </div>
          <div className="cm-f">
            {step ? (
              <button type="button" className="btn out" onClick={() => go(step - 1)} disabled={sending}>
                <I n="back" cls="sm" />
                Voltar
              </button>
            ) : (
              <small>{STEPS[0][1]}</small>
            )}
            <span style={{ flex: 1 }} />
            {last ? (
              <button type="button" className="btn" onClick={save} disabled={sending}>
                <I n={when === "now" ? "send" : "check"} cls="sm" />
                {sending
                  ? "Enviando…"
                  : when === "now"
                    ? "Enviar agora"
                    : "Agendar envio"}
              </button>
            ) : (
              <button type="button" className="btn" onClick={next}>
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
