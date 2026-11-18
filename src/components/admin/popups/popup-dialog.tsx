import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MediaUploadField } from "@/components/admin/community/content/media-upload-field";
import { SchedulePicker } from "@/components/admin/schedule-picker";
import { adminErrorMessage, adminToast } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useModalBehavior } from "@/hooks/admin/use-modal-behavior";
import { usePopupMutations, usePopupOptions } from "@/hooks/admin/use-admin-popups";
import { civilDateInSaoPaulo, formatDateTime } from "@/lib/admin/format";
import {
  buildPopupBody,
  buildTarget,
  EMPTY_POPUP_DRAFT,
  EXTERNAL_URL,
  fromInputValue,
  POPUP_BODY_MAX,
  POPUP_BUTTON_MAX,
  POPUP_IMAGE_HINT,
  POPUP_TITLE_MAX,
  popupDraftErrors,
  PRIORITY_LEVELS,
  priorityLevel,
  screenLabel,
  themeLabel,
  toInputValue,
  validatePopupImage,
  validUntil,
  type PopupDraft,
  type PopupField,
} from "@/lib/admin/popup-form";
import type { Popup } from "@/shared/popups.types";

import { PopupIcon } from "./popup-icon";
import { PopupPreview } from "./popup-preview";
import { PopupCampaignSelect, PopupTargetField } from "./popup-target-field";

import "@/styles/admin-notifications.css";
import "@/styles/admin-community.css";
import "@/styles/admin-popups.css";

const STEPS: [string, string][] = [
  ["Conteúdo", "O que a pessoa vê ao abrir o app"],
  ["Destino", "Botão, público e prioridade"],
  ["Início", "Quando o pop-up começa a valer"],
];

/** Campos que cada passo valida antes de deixar continuar. */
const STEP_FIELDS: PopupField[][] = [["title", "body"], ["buttonLabel", "screen", "targetId", "url", "campaignId", "priority"], ["startsAt"]];

interface Props {
  /** Pop-up em edição; sem ele, é um novo. */
  popup?: Popup;
  /** Ponto de partida (editar ou duplicar): os dados de um pop-up existente. */
  initial?: PopupDraft;
  onClose: () => void;
}

/** Rótulo do campo com o contador de caracteres na mesma linha, à direita. */
function FieldLabel({ htmlFor, children, optional, count }: { htmlFor: string; children: string; optional?: boolean; count?: { value: number; max: number } }) {
  return (
    <label className="n4l adm-pop-l" htmlFor={htmlFor}>
      <span>
        {children}
        {optional ? <em>opcional</em> : null}
      </span>
      {count ? (
        <small data-over={count.value > count.max ? "true" : undefined}>
          {count.value}/{count.max}
        </small>
      ) : null}
    </label>
  );
}

/** Bloco com cabeçalho (título e uma linha de apoio): a mesma anatomia nos três passos. */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="adm-pop-sec" aria-label={title}>
      <div className="adm-pop-sec-h">
        <b>{title}</b>
        {hint ? <small>{hint}</small> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Diálogo "Novo pop-up", no mesmo fluxo das notificações: três passos (conteúdo, destino, início) com a prévia ao lado.
 * Gravando, Esc, o fundo e "Fechar" não fecham; com algo mexido, o clique no fundo também não.
 */
export function PopupDialog({ popup, initial, onClose }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleDomId = useId();
  const ids = { title: useId(), body: useId(), button: useId(), audience: useId(), campaign: useId(), priority: useId() };
  const optionsQuery = usePopupOptions();
  const options = optionsQuery.data;
  const { create, update } = usePopupMutations();
  const saving = create.isPending || update.isPending;

  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<PopupDraft>(initial ?? EMPTY_POPUP_DRAFT);
  const patch = (next: Partial<PopupDraft>) => setDraft((current) => ({ ...current, ...next }));

  // Início: "agora" ou uma data e hora (Brasília). Editando um pop-up com início marcado, abre já em "agendar".
  const today = civilDateInSaoPaulo();
  const base = draft.startsAt || `${today}T10:00`;
  const [when, setWhen] = useState<"now" | "sched">(popup ? "sched" : "now");
  const [date, setDate] = useState(popup || base.slice(0, 10) >= today ? base.slice(0, 10) : today);
  const [time, setTime] = useState(base.slice(11, 16) || "10:00");
  const startsAt = when === "sched" ? `${date}T${time}` : "";

  const baseline = useRef(JSON.stringify(initial ?? EMPTY_POPUP_DRAFT));
  const dirty = JSON.stringify(draft) !== baseline.current || (!popup && when !== "now");

  const full = useMemo(() => ({ ...draft, startsAt }), [draft, startsAt]);
  const errors = useMemo(() => {
    const found = popupDraftErrors(full, options);
    // Agendar um pop-up novo no passado não faz sentido (editar um já no ar mantém a data que ele tem).
    const at = fromInputValue(startsAt);
    if (!popup && when === "sched" && at && new Date(at).getTime() < Date.now()) found.startsAt = "A data e a hora do início devem estar no futuro.";
    if (when === "sched" && !/^\d{2}:\d{2}$/.test(time)) found.startsAt = "Escolha o horário do início.";
    return found;
  }, [full, options, startsAt, popup, when, time]);
  const stepError = (k: number) => STEP_FIELDS[k].some((field) => errors[field]);
  const shown = (field: PopupField) => (tried ? errors[field] : undefined);

  useModalBehavior({ open: true, containerRef: dialogRef, onEscape: saving ? undefined : onClose });
  useEffect(() => {
    if (!saving) return;
    const dialog = dialogRef.current;
    const active = document.activeElement;
    if (dialog && (!active || active === document.body || !dialog.contains(active) || (active as HTMLElement).matches?.(":disabled"))) dialog.focus();
  }, [saving]);

  const go = (k: number) => {
    setStep(k);
    setTried(false);
  };
  const next = () => {
    if (stepError(step) || uploading) return setTried(true);
    go(step + 1);
  };

  const save = async () => {
    setTried(true);
    if (!options || saving || uploading) return;
    const failing = STEPS.findIndex((_, k) => stepError(k));
    if (failing !== -1) return go(failing);
    // Editando e escolhendo "começar agora": o início passa a ser este instante.
    const body = buildPopupBody({ ...draft, startsAt: when === "now" && popup ? toInputValue(new Date().toISOString()) : startsAt }, options, popup ? "edit" : "create");
    try {
      if (popup) await update.mutateAsync({ id: popup.id, body });
      else await create.mutateAsync(body);
      adminToast.success(popup ? "Pop-up salvo." : when === "now" ? "Pop-up criado." : "Pop-up agendado.");
      onClose();
    } catch (failure) {
      // A API explica em português (botão sem destino, campanha não encontrada…).
      adminToast.error(adminErrorMessage(failure, "Não foi possível salvar o pop-up."));
    }
  };

  const target = buildTarget(draft, options);
  const targetText = !target
    ? "Sem botão"
    : target.screen === EXTERNAL_URL
      ? `Link: ${draft.url.trim()}`
      : `${screenLabel(target.screen)}${draft.targetId ? ` · ${draft.targetId}` : ""}`;
  const until = validUntil(startsAt);
  const whenLabel = when === "now" ? "Assim que salvar" : formatDateTime(fromInputValue(startsAt));

  const stepBody = () => {
    if (!options) return null;
    if (step === 0) {
      return (
        <>
          <Section title="Mensagem" hint="O que a pessoa lê ao abrir o app.">
            <div className={`n4c ${shown("title") ? "bad" : ""}`}>
              <FieldLabel htmlFor={ids.title} count={{ value: draft.title.length, max: POPUP_TITLE_MAX }}>
                Título
              </FieldLabel>
              <input id={ids.title} className="cm-in" placeholder="Ex.: A Black Friday chegou!" value={draft.title} aria-invalid={shown("title") ? true : undefined} data-adm-autofocus autoComplete="off" onChange={(event) => patch({ title: event.target.value })} />
              {shown("title") ? <small className="nfe">{shown("title")}</small> : null}
            </div>
            <div className={`n4c ${shown("body") ? "bad" : ""}`}>
              <FieldLabel htmlFor={ids.body} optional count={{ value: draft.body.length, max: POPUP_BODY_MAX }}>
                Texto secundário
              </FieldLabel>
              <textarea id={ids.body} className="cm-ta" rows={3} placeholder="Texto puro, que aparece abaixo do título." value={draft.body} aria-invalid={shown("body") ? true : undefined} onChange={(event) => patch({ body: event.target.value })} />
              {shown("body") ? <small className="nfe">{shown("body")}</small> : null}
            </div>
          </Section>
          <Section title="Aparência" hint="Cor do cartão e o destaque do topo: um ícone ou uma imagem.">
            <div className="n4c">
              <span className="n4l">Fundo</span>
              <div className="adm-pop-themes" role="radiogroup" aria-label="Fundo">
                {options.themes.map((theme) => (
                  <button key={theme} type="button" role="radio" aria-checked={draft.theme === theme} className="adm-pop-theme" data-theme={theme} onClick={() => patch({ theme })}>
                    <i aria-hidden="true" />
                    {themeLabel(theme)}
                  </button>
                ))}
              </div>
            </div>

            <div className="n4c">
              <span className="n4l">Ícone</span>
              <div className="adm-pop-icons" role="radiogroup" aria-label="Ícone">
                <button type="button" role="radio" aria-checked={draft.icon === ""} className="adm-pop-icon" data-none="true" onClick={() => patch({ icon: "" })}>
                  Sem ícone
                </button>
                {options.icons.map((icon) => (
                  <button key={icon} type="button" role="radio" aria-checked={draft.icon === icon} aria-label={icon} title={icon} className="adm-pop-icon" onClick={() => patch({ icon })}>
                    <PopupIcon name={icon} size={20} />
                  </button>
                ))}
              </div>
            </div>

            <div className="n4c adm-pop-img-f">
              <MediaUploadField label="Imagem" kind="image" ratio="16 / 9" value={draft.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} disabled={saving} onBusyChange={setUploading} validate={validatePopupImage} hint={POPUP_IMAGE_HINT} />
              {draft.imageUrl && draft.icon ? <small className="lvf-ct">Com imagem e ícone juntos, a imagem é o destaque e o ícone fica de fora.</small> : null}
            </div>
          </Section>

        </>
      );
    }
    if (step === 1) {
      return (
        <>
          <Section title="Botão" hint="Opcional. Texto e página andam juntos; sem botão, o pop-up só informa e fecha.">
            <div className="adm-pop-2">
              <div className={`n4c ${shown("buttonLabel") ? "bad" : ""}`}>
                <FieldLabel htmlFor={ids.button} count={{ value: draft.buttonLabel.length, max: POPUP_BUTTON_MAX }}>
                  Texto do botão
                </FieldLabel>
                <input id={ids.button} className="cm-in" placeholder="Ex.: Ver carteira" value={draft.buttonLabel} aria-invalid={shown("buttonLabel") ? true : undefined} autoComplete="off" onChange={(event) => patch({ buttonLabel: event.target.value })} />
                {shown("buttonLabel") ? <small className="nfe">{shown("buttonLabel")}</small> : null}
              </div>
              <PopupTargetField draft={draft} options={options} error={shown("screen") ?? shown("targetId") ?? shown("url")} onChange={patch} />
            </div>
          </Section>

          <Section title="Quem vê" hint="Todos que abrirem o app, ou só quem participa de uma campanha.">
            <div className="n4tm lvf-wt" role="group" aria-label="Quem vê">
              <button type="button" className={draft.audience === "all" ? "on" : ""} aria-pressed={draft.audience === "all"} onClick={() => patch({ audience: "all", campaignId: "" })}>
                <I n="users" cls="sm" />
                Todos
              </button>
              <button type="button" className={draft.audience === "campaign" ? "on" : ""} aria-pressed={draft.audience === "campaign"} onClick={() => patch({ audience: "campaign" })}>
                <I n="mega" cls="sm" />
                Participantes de uma campanha
              </button>
            </div>
            {draft.audience === "campaign" ? (
              <div className={`n4c ${shown("campaignId") ? "bad" : ""}`}>
                <label className="n4l" htmlFor={ids.campaign}>
                  Campanha
                </label>
                <PopupCampaignSelect id={ids.campaign} value={draft.campaignId} onChange={(campaignId) => patch({ campaignId })} invalid={!!shown("campaignId")} />
                {shown("campaignId") ? <small className="nfe">{shown("campaignId")}</small> : null}
              </div>
            ) : null}
          </Section>

          <Section title="Prioridade" hint="Cada pessoa vê no máximo 1 pop-up por dia.">
            <div className="n4tm lvf-wt adm-pop-prio" role="group" aria-label="Prioridade">
              {PRIORITY_LEVELS.map((level) => (
                <button key={level.key} type="button" className={priorityLevel(draft.priority).key === level.key ? "on" : ""} aria-pressed={priorityLevel(draft.priority).key === level.key} onClick={() => patch({ priority: String(level.value) })}>
                  {level.label}
                </button>
              ))}
            </div>
            <small className="adm-pop-prio-h">
              {priorityLevel(draft.priority).hint} Com vários pop-ups válidos no dia, aparece o de maior prioridade; os outros ficam para os dias seguintes.
            </small>
          </Section>
        </>
      );
    }
    return (
      <>
        <Section title="Quando começa" hint="Agora, ou numa data e hora (horário de Brasília).">
          <div className="n4tm lvf-wt" role="group" aria-label="Quando começa">
            <button type="button" className={when === "now" ? "on" : ""} aria-pressed={when === "now"} onClick={() => setWhen("now")}>
              <I n="send" cls="sm" />
              Começar agora
            </button>
            <button type="button" className={when === "sched" ? "on" : ""} aria-pressed={when === "sched"} onClick={() => setWhen("sched")}>
              <I n="cal" cls="sm" />
              Agendar para depois
            </button>
          </div>
          {when === "sched" ? (
            <SchedulePicker date={date} time={time} onDate={setDate} onTime={setTime} minDate={popup && date < today ? date : today} />
          ) : (
            <div className="lvq-now">
              <span>
                <I n="send" />
              </span>
              <b>Vale a partir de agora</b>
              <small>As pessoas passam a ver ao abrir o app.</small>
            </div>
          )}
          {tried && errors.startsAt ? <small className="nfe">{errors.startsAt}</small> : null}
        </Section>

        <Section title="Quanto tempo vale" hint="Não existe campo de fim: a plataforma encerra o pop-up sozinha.">
          <dl className="adm-pop-span">
            <div>
              <dt>Começa</dt>
              <dd>{whenLabel}</dd>
            </div>
            <div className="adm-pop-span-m" aria-hidden="true">
              <i />
              <b>1 dia</b>
              <i />
            </div>
            <div>
              <dt>Termina</dt>
              <dd>{formatDateTime(until)}</dd>
            </div>
          </dl>
        </Section>
      </>
    );
  };

  const last = step === STEPS.length - 1;
  const submitLabel = popup ? "Salvar alterações" : when === "now" ? "Criar pop-up" : "Agendar pop-up";

  return createPortal(
    <div className="pv">
      <div className="ovb on" aria-hidden="true" onClick={() => !saving && !dirty && onClose()} />
      <div className="ovw">
        <section ref={dialogRef} className="ovd on wide lvfm ntm ntw adm-pop-dlg" role="dialog" aria-modal="true" aria-labelledby={titleDomId} aria-busy={saving ? true : undefined} tabIndex={-1}>
          <div className="sh-h cm-h">
            <div>
              <small>Pop-ups</small>
              <h2 id={titleDomId}>{popup ? "Editar pop-up" : "Novo pop-up"}</h2>
            </div>
            <button type="button" className="round" onClick={onClose} disabled={saving} aria-label="Fechar">
              <I n="x" cls="sm" />
            </button>
          </div>
          <div className="ntw-w">
            <div className="sh-seg lvf-sg" role="group" aria-label="Passos do pop-up" style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}>
              {STEPS.map(([title], k) => (
                <button key={title} type="button" className={`${step === k ? "on" : ""} ${k < step ? "dn" : ""}`} aria-current={step === k ? "step" : undefined} disabled={saving} onClick={() => k < step && go(k)}>
                  <span>{k < step ? <I n="check" cls="sm" /> : k + 1}</span>
                  {title}
                </button>
              ))}
            </div>
            <div className="ntw-m">
              <div className="lvf-bd swp" key={step}>
                {optionsQuery.isLoading ? (
                  <p className="adm-pop-load" role="status">
                    Carregando opções…
                  </p>
                ) : optionsQuery.error || !options ? (
                  <div className="adm-pop-load" role="alert">
                    <p>{adminErrorMessage(optionsQuery.error, "Não foi possível carregar as opções.")}</p>
                    <button type="button" className="btn out" onClick={() => void optionsQuery.refetch()} disabled={optionsQuery.isFetching}>
                      <I n="refresh" cls="sm" />
                      Tentar de novo
                    </button>
                  </div>
                ) : (
                  stepBody()
                )}
              </div>
              <aside className="ntw-pv" aria-label="Prévia do pop-up">
                <small className="ntw-pl">Prévia no app</small>
                <PopupPreview draft={draft} />
                <ul className="ntw-sm">
                  <li>
                    <span>Público</span>
                    <b>{draft.audience === "campaign" ? "Participantes de uma campanha" : "Todos"}</b>
                  </li>
                  <li>
                    <span>Botão leva a</span>
                    <b style={{ wordBreak: "break-all" }}>{targetText}</b>
                  </li>
                  <li>
                    <span>Prioridade</span>
                    <b>{priorityLevel(draft.priority).label}</b>
                  </li>
                  <li>
                    <span>Começa</span>
                    <b>{whenLabel}</b>
                  </li>
                </ul>
              </aside>
            </div>
          </div>
          <div className="cm-f">
            {step ? (
              <button type="button" className="btn out" onClick={() => go(step - 1)} disabled={saving}>
                <I n="back" cls="sm" />
                Voltar
              </button>
            ) : (
              <small>{STEPS[0][1]}</small>
            )}
            <span style={{ flex: 1 }} />
            {last ? (
              <button type="button" className="btn" onClick={() => void save()} disabled={saving || uploading || !options}>
                <I n={when === "now" ? "send" : "check"} cls="sm" />
                {saving ? "Salvando…" : submitLabel}
              </button>
            ) : (
              <button type="button" className="btn" onClick={next} disabled={!options || uploading}>
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
