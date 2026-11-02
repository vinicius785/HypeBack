import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { I } from "@/components/prototype/ui";
import { useModalBehavior } from "@/hooks/admin/use-modal-behavior";

import "@/styles/admin-platform.css";

export const ADMIN_REASON_MIN = 5;
export const ADMIN_REASON_MAX = 500;

/** Limites do motivo no contrato (`AdminReasonBody.reason`: 5 a 500 caracteres, contados depois de aparar). */
export interface AdminReasonConfig {
  label?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface AdminConfirmValues {
  /** Motivo já aparado (`''` quando o diálogo não pede motivo). */
  reason: string;
  /** O que foi digitado na confirmação (`''` quando não há). */
  confirmText: string;
}

export interface AdminConfirmDialogProps {
  open: boolean;
  title: string;
  /** Linha pequena acima do título ("Workspace · Acme Ltda"). */
  eyebrow?: string;
  description?: ReactNode;
  /** "O que acontece": uma frase por item. */
  consequences?: readonly ReactNode[];
  consequencesTitle?: string;
  /** Conteúdo livre entre a descrição e os campos (resumo de impacto, impedimentos). */
  children?: ReactNode;
  /** `danger`: botão vermelho e `alertdialog`. `neutral`: botão preto. */
  tone?: "danger" | "neutral";
  confirmLabel: string;
  cancelLabel?: string;
  /** Gravando: tudo travado, Escape e clique fora não fecham, o botão mostra `pendingLabel`. */
  pending?: boolean;
  pendingLabel?: string;
  /** Erro da última tentativa (o diálogo continua aberto para a pessoa corrigir e tentar de novo). */
  error?: string | null;
  /** Campo de motivo (5 a 500). Padrão: pede, porque toda mutação do Admin exige. `false` tira o campo. */
  reason?: false | AdminReasonConfig;
  /** Confirmação digitada (o nome do workspace): o botão só habilita quando confere. */
  typedConfirmation?: { expected: string; label?: string; hint?: string };
  /** Trava extra (ex.: o resumo de impacto ainda não chegou ou há impedimentos). */
  confirmDisabled?: boolean;
  wide?: boolean;
  /**
   * O chamador tem dado digitado que se perde ao fechar (ex.: os campos de um formulário nos `children`).
   * O que o próprio diálogo guarda (motivo e confirmação digitada) já conta sozinho.
   * Com dado a perder, um clique fora não fecha; Escape e o botão de cancelar continuam fechando.
   */
  dirty?: boolean;
  onConfirm: (values: AdminConfirmValues) => void;
  onClose: () => void;
}

/** Compara o texto digitado com o esperado: sem diferenciar maiúsculas e com as pontas aparadas. */
export function typedConfirmationMatches(typed: string, expected: string): boolean {
  const norm = (s: string) => s.normalize("NFC").trim().toLocaleLowerCase("pt-BR");
  return norm(expected) !== "" && norm(typed) === norm(expected);
}

/**
 * Diálogo de confirmação das ações do Admin (suspender, arquivar, excluir, revogar sessões…).
 *
 * O que ele garante: botão desabilitado até o motivo (5 a 500) e a confirmação digitada estarem corretos;
 * estado de gravação que trava tudo; foco preso dentro, `aria-modal`, Escape, rolagem da página travada e
 * foco devolvido a quem abriu (`useModalBehavior`); erro da tentativa dentro do próprio diálogo.
 *
 * O texto do diálogo reinicia a cada abertura (o conteúdo só existe enquanto `open`).
 */
export function AdminConfirmDialog(props: AdminConfirmDialogProps) {
  if (!props.open) return null;
  return <AdminConfirmDialogBody {...props} />;
}

function AdminConfirmDialogBody({
  title,
  eyebrow,
  description,
  consequences,
  consequencesTitle = "O que acontece",
  children,
  tone = "neutral",
  confirmLabel,
  cancelLabel = "Cancelar",
  pending = false,
  pendingLabel = "Aguarde…",
  error,
  reason: reasonOption,
  typedConfirmation,
  confirmDisabled = false,
  wide,
  dirty = false,
  onConfirm,
  onClose,
}: AdminConfirmDialogProps) {
  const reasonConfig = reasonOption === false ? null : { min: ADMIN_REASON_MIN, max: ADMIN_REASON_MAX, ...reasonOption };
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [typed, setTyped] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const reasonHintId = useId();
  const typedId = useId();

  const requestClose = () => {
    if (!pending) onClose();
  };
  useModalBehavior({ open: true, containerRef: dialogRef, onEscape: requestClose });

  const trimmedReason = reason.trim();
  // Um clique que escapa para fora do diálogo não pode jogar fora o que foi digitado.
  const hasTypedData = dirty || trimmedReason !== "" || typed.trim() !== "";
  const reasonValid = !reasonConfig || (trimmedReason.length >= reasonConfig.min && trimmedReason.length <= reasonConfig.max);
  const typedValid = !typedConfirmation || typedConfirmationMatches(typed, typedConfirmation.expected);
  const canConfirm = !pending && !confirmDisabled && reasonValid && typedValid;
  const showReasonError = !!reasonConfig && reasonTouched && !reasonValid;
  const danger = tone === "danger";
  const hasDescription = !!description || !!consequences?.length;
  // Sem campo nenhum para preencher, o foco inicial vai para "Cancelar": Enter não confirma por acidente.
  const hasFields = !!reasonConfig || !!typedConfirmation;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setReasonTouched(true);
    if (!canConfirm) return;
    onConfirm({ reason: trimmedReason, confirmText: typed });
  };

  return createPortal(
    <div className="pv">
      <div
        className="adm-overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !hasTypedData) requestClose();
        }}
      >
        <section
          ref={dialogRef}
          className="adm-dialog"
          role={danger ? "alertdialog" : "dialog"}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={hasDescription ? descriptionId : undefined}
          aria-busy={pending ? true : undefined}
          data-tone={tone}
          data-wide={wide ? "true" : undefined}
          tabIndex={-1}
        >
          <form onSubmit={submit} noValidate style={{ display: "contents" }}>
            <header className="adm-dialog-h">
              <div>
                {eyebrow ? <small>{eyebrow}</small> : null}
                <h2 id={titleId}>{title}</h2>
              </div>
              <button type="button" className="adm-iconbtn" aria-label="Fechar" disabled={pending} onClick={requestClose}>
                <I n="x" cls="sm" />
              </button>
            </header>

            <div className="adm-dialog-b">
              {hasDescription ? (
                <div id={descriptionId} style={{ display: "contents" }}>
                  {description ? <p className="adm-dialog-desc">{description}</p> : null}
                  {consequences && consequences.length > 0 ? (
                    <div className="adm-conseq">
                      <b>{consequencesTitle}</b>
                      <ul>
                        {consequences.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {children}

              {reasonConfig ? (
                <div className="adm-field">
                  <label htmlFor={reasonId}>
                    {reasonConfig.label ?? "Motivo"} <span>(obrigatório, fica registrado no histórico)</span>
                  </label>
                  <textarea
                    id={reasonId}
                    className="adm-input"
                    value={reason}
                    maxLength={reasonConfig.max}
                    readOnly={pending}
                    placeholder={reasonConfig.placeholder ?? "Explique por que esta ação está sendo feita"}
                    aria-invalid={showReasonError ? true : undefined}
                    aria-describedby={reasonHintId}
                    data-adm-autofocus
                    onChange={(event) => setReason(event.target.value)}
                    onBlur={(event) => {
                      // Foco devolvido por código a quem abriu o diálogo (o StrictMode do dev monta, desmonta e
                      // monta de novo) não é a pessoa saindo do campo: não vira "campo tocado".
                      const next = event.relatedTarget;
                      if (next instanceof Node && !dialogRef.current?.contains(next)) return;
                      setReasonTouched(true);
                    }}
                  />
                  <div className="adm-field-foot" id={reasonHintId}>
                    <span data-error={showReasonError ? "true" : undefined}>
                      {showReasonError ? `Descreva o motivo com pelo menos ${reasonConfig.min} caracteres.` : ""}
                    </span>
                    <span className="adm-field-count" data-over={reason.length >= reasonConfig.max ? "true" : undefined}>
                      {reason.length}/{reasonConfig.max}
                    </span>
                  </div>
                </div>
              ) : null}

              {typedConfirmation ? (
                <div className="adm-field">
                  <label htmlFor={typedId}>
                    {typedConfirmation.label ?? (
                      <>
                        Para confirmar, digite <b>{typedConfirmation.expected}</b>
                      </>
                    )}
                  </label>
                  <input
                    id={typedId}
                    type="text"
                    className="adm-input"
                    value={typed}
                    readOnly={pending}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder={typedConfirmation.expected}
                    data-adm-autofocus={reasonConfig ? undefined : true}
                    onChange={(event) => setTyped(event.target.value)}
                  />
                  {typedConfirmation.hint ? <div className="adm-field-foot">{typedConfirmation.hint}</div> : null}
                </div>
              ) : null}

              {error ? (
                <div className="adm-dialog-error" role="alert">
                  {error}
                </div>
              ) : null}
            </div>

            <footer className="adm-dialog-f">
              <button type="button" className="btn out" disabled={pending} data-adm-autofocus={hasFields ? undefined : true} onClick={requestClose}>
                {cancelLabel}
              </button>
              <button type="submit" className={`btn${danger ? " dng" : ""}`} disabled={!canConfirm}>
                {pending ? pendingLabel : confirmLabel}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </div>,
    document.body,
  );
}
