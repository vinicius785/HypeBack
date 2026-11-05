import type { ReactNode } from "react";

export type FieldKey = "title" | "description" | "status" | "priority" | "due_date" | "tags" | "assignees";

/** Resultado de gravar um campo (só no modo de edição, que salva campo a campo). */
export interface FieldFeedback {
  state: "saving" | "saved" | "error";
  message?: string;
}

export function FieldLabel({ htmlFor, id, feedback, children }: { htmlFor?: string; id?: string; feedback?: FieldFeedback; children: ReactNode }) {
  return (
    <div className="apj-tm-lbl">
      {htmlFor ? (
        <label htmlFor={htmlFor}>{children}</label>
      ) : (
        <span id={id} className="apj-lbl">
          {children}
        </span>
      )}
      {feedback ? (
        <span className={`apj-tm-fb ${feedback.state}`} role={feedback.state === "error" ? "alert" : "status"}>
          {feedback.state === "saving" ? "Salvando…" : feedback.state === "saved" ? "Salvo" : (feedback.message ?? "Não foi possível salvar")}
        </span>
      ) : null}
    </div>
  );
}
