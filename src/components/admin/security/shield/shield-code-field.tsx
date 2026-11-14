import { useId } from "react";

import { isShieldCodeComplete } from "@/lib/admin/shield";

/**
 * Campo do código de 6 dígitos do Authenticator. O valor fica só no estado de quem o usa (nunca em armazenamento, URL ou log);
 * só aceita dígitos e `autoComplete="one-time-code"` deixa o teclado do celular sugerir o código.
 */
export function ShieldCodeField({
  value,
  onChange,
  disabled,
  error,
  label = "Código do Authenticator",
  autoFocus,
  hideLabel,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  error?: string | null;
  label?: string;
  autoFocus?: boolean;
  /** O rótulo vira só texto para leitor de tela (a janela já tem um título na etapa). */
  hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div className="adm-field adm-shield-code">
      <label htmlFor={id} className={hideLabel ? "adm-sr" : undefined}>
        {label}
      </label>
      <input
        id={id}
        className="adm-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        spellCheck={false}
        placeholder="000000"
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        data-adm-autofocus={autoFocus ? "" : undefined}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
      />
      <div className="adm-field-foot">
        <span
          data-error={error ? "true" : undefined}
          role={error ? "alert" : undefined}
        >
          {error ??
            (value.length > 0 && !isShieldCodeComplete(value)
              ? "O código tem 6 dígitos."
              : "")}
        </span>
      </div>
    </div>
  );
}
