import type { ReactNode } from "react";

import "@/styles/settings.css";

interface SectionProps {
  id: string;
  title: string;
  description?: ReactNode;
  /** Ação principal da seção (ex.: "Adicionar membro"): fica sob a descrição, na coluna do título. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Seção das Configurações: o título e a descrição à esquerda, o conteúdo à direita, numa largura de leitura
 * controlada. Todas as abas (Marca, Equipe, Avançado) montam suas seções assim, sem cartão em volta: o cartão só
 * existe onde há função (lista de membros, prévia).
 */
export function SettingsSection({ id, title, description, action, children }: SectionProps) {
  return (
    <section className="st-sec" aria-labelledby={id}>
      <header>
        <div className="st-ht">
          <h3 id={id}>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="st-hact">{action}</div> : null}
      </header>
      <div className="st-sec-b">{children}</div>
    </section>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  optional?: boolean;
  /** Texto à direita do rótulo (ex.: contador de caracteres). */
  aside?: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}

/** Campo com rótulo acima, dica e erro: o mesmo em todos os formulários das Configurações. */
export function Field({ label, htmlFor, optional, aside, error, hint, children }: FieldProps) {
  return (
    <div className={`st-f${error ? " bad" : ""}`}>
      <div className="st-fl">
        <label htmlFor={htmlFor}>
          {label}
          {optional ? <em>opcional</em> : null}
        </label>
        {aside ? <span>{aside}</span> : null}
      </div>
      {children}
      {error ? <small className="st-err">{error}</small> : hint ? <small className="st-hint">{hint}</small> : null}
    </div>
  );
}
