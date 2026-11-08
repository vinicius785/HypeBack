import { useState } from "react";
import { Headset } from "lucide-react";

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
          <label className="nf">
            <span>Sobre o que é?</span>
            <select className="ni" value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)}>
              {SUPPORT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {SUPPORT_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className={`nf${tried && subjectError ? " err" : ""}`}>
            <span>Assunto</span>
            <input
              className="ni"
              data-adm-autofocus=""
              maxLength={SUPPORT_SUBJECT_MAX}
              placeholder="Ex.: Não consigo convidar um criador"
              value={subject}
              aria-invalid={tried && subjectError ? true : undefined}
              onChange={(e) => setSubject(e.target.value)}
            />
            {tried && subjectError ? <small className="nfe">{subjectError}</small> : null}
          </label>
          <label className={`nf${tried && messageError ? " err" : ""}`}>
            <span>Mensagem</span>
            <textarea
              className="ni ta"
              rows={6}
              maxLength={SUPPORT_MESSAGE_MAX}
              placeholder="Descreva o que aconteceu, o que você esperava e, se puder, os passos para repetir."
              value={message}
              aria-invalid={tried && messageError ? true : undefined}
              onChange={(e) => setMessage(e.target.value)}
            />
            {tried && messageError ? <small className="nfe">{messageError}</small> : null}
          </label>
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
