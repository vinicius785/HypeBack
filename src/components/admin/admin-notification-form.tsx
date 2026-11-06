import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
import { adminErrorMessage, adminToast } from "@/components/admin/platform";
import { useModalBehavior } from "@/hooks/admin/use-modal-behavior";
import {
  useCreateAdminNotification,
  useEstimateAdminAudience,
} from "@/hooks/use-admin-notifications";
import { formatInt } from "@/lib/admin/format";
import type {
  AdminAudienceEstimate,
  AdminAudienceFilter,
  AdminNotificationChannel,
  AdminNotificationCreatePayload,
} from "@/shared/types";
import { createIdempotencyKeeper } from "@/shared/utils/idempotency-key";
import { TimeClock } from "@/components/campaign-wizard/time-pick";

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

/**
 * Diálogo "Nova notificação", em três passos (mensagem, destino, envio). Gravando, Esc, o fundo e "Fechar" não
 * fecham. Com algo digitado ou escolhido, o clique no fundo não fecha (Esc e "Fechar" continuam fechando).
 */
export function AdminNotificationForm({
  initial,
  onClose,
}: AdminNotificationFormProps) {
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const titleDomId = useId();
  const titleFieldId = useId();
  const bodyFieldId = useId();
  const linkFieldId = useId();
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

  // Há algo mexido desde que o diálogo abriu (em relação ao que veio preenchido, no "Duplicar"): o fundo não fecha.
  const baseline = useRef({
    title,
    body,
    ctaUrl,
    channels: JSON.stringify(channels),
    audience: JSON.stringify(audience),
  });
  const dirty =
    title !== baseline.current.title ||
    body !== baseline.current.body ||
    ctaUrl !== baseline.current.ctaUrl ||
    JSON.stringify(channels) !== baseline.current.channels ||
    JSON.stringify(audience) !== baseline.current.audience ||
    when !== "now";

  const estimateMutation = useEstimateAdminAudience();
  const createMutation = useCreateAdminNotification();
  const sending = createMutation.isPending;
  // Envio imediato pede confirmação (não dá para desfazer). A chave de
  // idempotência do POST é a mesma para o mesmo conteúdo: reenviar após timeout
  // ou queda de rede não dispara para todo mundo de novo.
  const [confirming, setConfirming] = useState(false);
  const [idempotencyKeyFor] = useState(createIdempotencyKeeper);

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

  // Diálogo de verdade: foco preso e devolvido, rolagem travada, `aria-modal`. Gravando, o Esc só é engolido; com a
  // confirmação de envio aberta, o Esc volta ao resumo em vez de fechar tudo.
  useModalBehavior({
    open: true,
    containerRef: dialogRef,
    onEscape: sending ? undefined : () => (confirming ? setConfirming(false) : onClose()),
  });

  // Ao começar a gravar o botão acionado fica desabilitado e o navegador larga o foco no <body>: fica no painel.
  useEffect(() => {
    if (!sending) return;
    const dialog = dialogRef.current;
    const active = document.activeElement;
    if (!dialog) return;
    if (!active || active === document.body || !dialog.contains(active) || (active as HTMLElement).matches?.(":disabled")) {
      dialog.focus();
    }
  }, [sending]);

  const reach = estimate?.total_recipients ?? 0;
  const fmt = formatInt;
  const reachLabel = estimate ? `${fmt(reach)} criadores` : null;
  const channelsLabel = channels.map((c) => CHANNEL_LABEL[c]).join(", ");
  const confirmText = `Enviar agora para ${fmt(reach)} ${
    reach === 1 ? "criador" : "criadores"
  } (${channelsLabel})? Um envio imediato não pode ser desfeito.`;
  const urlBad = !validateUrl(ctaUrl.trim());

  const step0Ok = !!title.trim() && !!body.trim() && !urlBad;
  const step1Err = audienceError(audience);
  const step1Ok = !step1Err && channels.length > 0 && !!estimate && reach > 0;

  const whenLabel =
    when === "now"
      ? "Assim que confirmar"
      : (() => {
          const d = new Date(`${date}T12:00:00`);
          return `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}, ${time || "sem horário"}`;
        })();

  const go = (k: number) => {
    setStep(k);
    setTried(false);
    setConfirming(false);
  };

  const chooseWhen = (w: "now" | "sched") => {
    setWhen(w);
    setConfirming(false);
  };

  const next = () => {
    if (step === 0 && !step0Ok) return setTried(true);
    if (step === 1 && !step1Ok) {
      setTried(true);
      if (estimating) adminToast.error("Aguarde o cálculo do alcance.");
      return;
    }
    go(step + 1);
  };

  const save = async () => {
    if (when === "sched" && !/^\d{2}:\d{2}$/.test(time)) {
      adminToast.error("Escolha o horário do envio.");
      return;
    }
    const scheduledAt = when === "sched" ? new Date(`${date}T${time}:00`) : null;
    if (scheduledAt && scheduledAt.getTime() < Date.now()) {
      adminToast.error("A data/hora do agendamento deve estar no futuro.");
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
      await createMutation.mutateAsync({
        payload,
        idempotencyKey: idempotencyKeyFor(JSON.stringify(payload)),
      });
      adminToast.success(
        when === "now" ? "Notificação enviada para a fila." : "Envio agendado.",
      );
      onClose();
    } catch (err) {
      adminToast.error(adminErrorMessage(err, "Não foi possível criar a notificação."));
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
            <label className="n4l" htmlFor={titleFieldId}>
              Título
            </label>
            <input
              id={titleFieldId}
              className="cm-in"
              maxLength={TITLE_MAX}
              placeholder="Ex.: Nova campanha aberta para você!"
              value={title}
              aria-invalid={tried && !title.trim() ? true : undefined}
              aria-describedby={tried && !title.trim() ? `${titleFieldId}-err` : undefined}
              data-adm-autofocus
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
            />
            <small className="lvf-ct">
              {title.length}/{TITLE_MAX}
            </small>
            {tried && !title.trim() ? (
              <small className="nfe" id={`${titleFieldId}-err`}>
                Escreva um título
              </small>
            ) : null}
          </div>
          <div className={`n4c ${tried && !body.trim() ? "bad" : ""}`}>
            <label className="n4l" htmlFor={bodyFieldId}>
              Mensagem
            </label>
            <textarea
              id={bodyFieldId}
              className="cm-ta"
              rows={4}
              maxLength={BODY_MAX}
              placeholder="Escreva o que os criadores vão ler."
              value={body}
              aria-invalid={tried && !body.trim() ? true : undefined}
              aria-describedby={tried && !body.trim() ? `${bodyFieldId}-err` : undefined}
              onChange={(e) => setBody(e.target.value)}
            />
            <small className="lvf-ct">
              {body.length}/{BODY_MAX}
            </small>
            {tried && !body.trim() ? (
              <small className="nfe" id={`${bodyFieldId}-err`}>
                Escreva a mensagem
              </small>
            ) : null}
          </div>
          <div className={`n4c ${tried && urlBad ? "bad" : ""}`}>
            <label className="n4l" htmlFor={linkFieldId}>
              Link ao tocar <em>opcional</em>
            </label>
            <input
              id={linkFieldId}
              className="cm-in"
              placeholder="https://… ou hypeapp://campanha/123"
              value={ctaUrl}
              aria-invalid={tried && urlBad ? true : undefined}
              aria-describedby={tried && urlBad ? `${linkFieldId}-err` : undefined}
              onChange={(e) => setCtaUrl(e.target.value)}
              autoComplete="off"
            />
            {tried && urlBad ? (
              <small className="nfe" id={`${linkFieldId}-err`}>
                URL inválida — use http(s):// ou esquema com ://
              </small>
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
            aria-live="polite"
            aria-atomic="true"
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
          <button type="button" className={when === "now" ? "on" : ""} onClick={() => chooseWhen("now")}>
            <I n="send" cls="sm" />
            Enviar agora
          </button>
          <button type="button" className={when === "sched" ? "on" : ""} onClick={() => chooseWhen("sched")}>
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
              <TimeClock value={time} onChange={setTime} />
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
      {/* O fundo não fecha gravando nem com algo digitado (um clique perdido jogaria o texto fora); Esc e "Fechar" fecham. */}
      <div className="ovb on" aria-hidden="true" onClick={() => !sending && !dirty && onClose()} />
      <div className="ovw">
        <section
          ref={dialogRef}
          className="ovd on wide lvfm ntm ntw"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleDomId}
          aria-busy={sending ? true : undefined}
          tabIndex={-1}
        >
          <div className="sh-h cm-h">
            <div>
              <small>Notificações</small>
              <h2 id={titleDomId}>Nova notificação</h2>
            </div>
            <button type="button" className="round" onClick={onClose} disabled={sending} aria-label="Fechar">
              <I n="x" cls="sm" />
            </button>
          </div>
          <div className="ntw-w">
            <div
              className="sh-seg lvf-sg"
              role="group"
              aria-label="Passos da notificação"
              style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}
            >
              {STEPS.map(([t], k) => (
                <button
                  key={t}
                  type="button"
                  className={`${step === k ? "on" : ""} ${k < step ? "dn" : ""}`}
                  aria-current={step === k ? "step" : undefined}
                  disabled={sending}
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
              <aside className="ntw-pv" aria-label="Prévia da notificação">
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
            {confirming ? (
              <>
                <small style={{ flex: 1 }}>{confirmText}</small>
                <button type="button" className="btn out" onClick={() => setConfirming(false)} disabled={sending}>
                  <I n="back" cls="sm" />
                  Voltar
                </button>
                <button type="button" className="btn" onClick={save} disabled={sending}>
                  <I n="send" cls="sm" />
                  {sending ? "Enviando…" : "Confirmar envio"}
                </button>
              </>
            ) : (
              <>
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
                  <button
                    type="button"
                    className="btn"
                    onClick={when === "now" ? () => setConfirming(true) : save}
                    disabled={sending}
                  >
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
              </>
            )}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
