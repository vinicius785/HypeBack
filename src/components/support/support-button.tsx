import { useState } from "react";
import { Bug, Check, CircleHelp, Headset, Lightbulb, Megaphone, Users, UserRound, Wallet, type LucideIcon } from "lucide-react";

import { AdminDialog } from "@/components/admin/platform/admin-dialog";
import { SUPPORT_CATEGORIES, SUPPORT_CATEGORY_LABEL, type SupportCategory } from "@/shared/services/admin-support";
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_MESSAGE_MIN,
  SUPPORT_SUBJECT_MAX,
  SUPPORT_SUBJECT_MIN,
  createSupportRequest,
} from "@/shared/services/support-requests";

import "@/styles/support-request.css";

const CATEGORY_ICON: Record<SupportCategory, LucideIcon> = {
  account: UserRound,
  billing: Wallet,
  campaign: Megaphone,
  creator: Users,
  bug: Bug,
  feature: Lightbulb,
  other: CircleHelp,
};

/** Botão redondo "Falar com o suporte" do topo: abre o formulário que cria o pedido na fila do Suporte do Admin. */
export function SupportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="round" aria-label="Falar com o suporte" title="Falar com o suporte" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Headset className="ico" aria-hidden />
      </button>
      {open ? <SupportDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SupportDialog({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<SupportCategory>("other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  const subjectError = subject.trim().length < SUPPORT_SUBJECT_MIN ? "Informe o assunto" : null;
  const messageError = message.trim().length < SUPPORT_MESSAGE_MIN ? `Conte um pouco mais (mínimo de ${SUPPORT_MESSAGE_MIN} caracteres)` : null;
  const dirty = !sent && (subject.trim() !== "" || message.trim() !== "");

  const submit = async () => {
    setTried(true);
    setError(null);
    if (subjectError || messageError) return;
    setBusy(true);
    try {
      const ticket = await createSupportRequest({ subject, message, category });
      setSent(ticket.number);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Não foi possível enviar o pedido. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminDialog
      open
      title="Falar com o suporte"
      description={sent ? undefined : "Conte o que está acontecendo. A equipe responde pelas notificações da plataforma."}
      size="md"
      busy={busy}
      dirty={dirty}
      onClose={onClose}
      footer={
        sent ? (
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
        ) : (
          <>
            <button type="button" className="btn out" disabled={busy} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" form="support-request-form" className="btn" disabled={busy}>
              {busy ? "Enviando…" : "Enviar pedido"}
            </button>
          </>
        )
      }
    >
      {sent ? (
        <div className="sup-done" role="status">
          <span className="sup-ok" aria-hidden>
            <Check className="ico" />
          </span>
          <b>Pedido #{sent} enviado</b>
          <p>Recebemos o seu pedido. Quando a equipe responder, você recebe uma notificação aqui na plataforma.</p>
        </div>
      ) : (
        <form
          id="support-request-form"
          className="sup-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <fieldset className="sup-cat">
            <legend>Sobre o que é?</legend>
            <div className="sup-chips">
              {SUPPORT_CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICON[c];
                return (
                  <label key={c} className={`sup-chip${category === c ? " on" : ""}`}>
                    <input
                      type="radio"
                      name="support-category"
                      value={c}
                      checked={category === c}
                      onChange={() => setCategory(c)}
                    />
                    <Icon className="ico" aria-hidden />
                    {SUPPORT_CATEGORY_LABEL[c]}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className={`nf${tried && subjectError ? " err" : ""}`}>
            <label htmlFor="support-subject">Assunto</label>
            <input
              id="support-subject"
              className="ni"
              data-adm-autofocus=""
              maxLength={SUPPORT_SUBJECT_MAX}
              placeholder="Ex.: Não consigo convidar um criador"
              value={subject}
              aria-invalid={tried && subjectError ? true : undefined}
              onChange={(e) => setSubject(e.target.value)}
            />
            <span className="sup-meta">
              {tried && subjectError ? <small className="nfe">{subjectError}</small> : <small />}
              <small className="sup-count">
                {subject.length}/{SUPPORT_SUBJECT_MAX}
              </small>
            </span>
          </div>
          <div className={`nf${tried && messageError ? " err" : ""}`}>
            <label htmlFor="support-message">Mensagem</label>
            <textarea
              id="support-message"
              className="ni ta"
              rows={6}
              maxLength={SUPPORT_MESSAGE_MAX}
              placeholder="Descreva o que aconteceu, o que você esperava e, se puder, os passos para repetir."
              value={message}
              aria-invalid={tried && messageError ? true : undefined}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <span className="sup-meta">
              {tried && messageError ? <small className="nfe">{messageError}</small> : <small>Quanto mais detalhe, mais rápido a equipe resolve.</small>}
              <small className="sup-count">
                {message.length}/{SUPPORT_MESSAGE_MAX}
              </small>
            </span>
          </div>
          <p className="sup-ctx">
            <CircleHelp className="ico" aria-hidden />
            Enviamos junto a página em que você está, para a equipe ver o mesmo que você.
          </p>
          {error ? (
            <div className="sup-err" role="alert">
              {error}
            </div>
          ) : null}
        </form>
      )}
    </AdminDialog>
  );
}
