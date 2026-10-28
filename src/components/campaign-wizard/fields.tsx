import { useEffect, useRef, useState, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";

/** Campo com rótulo (`.nf`) do assistente do protótipo. Envolva tudo em `.pv`. */
export function Field({
  label,
  children,
  err,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  err?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`nf ${err ? "err" : ""} ${className}`.trim()}>
      <label>{label}</label>
      {children}
      {hint ? <small className="nfh">{hint}</small> : null}
    </div>
  );
}

/** Aviso de campo obrigatório (`.nfe`), só depois de tentar avançar. */
export function FieldError({ show, children }: { show: boolean; children: ReactNode }) {
  return show ? <small className="nfe">{children}</small> : null;
}

/** Campo de valor em reais (`.nmn`): guarda a string mascarada, igual ao formulário antigo. */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  ariaLabel,
}: {
  value: string;
  onChange: (masked: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="nmn">
      <span>R$</span>
      <input
        className="ni"
        inputMode="numeric"
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(maskMoney(e.target.value))}
      />
    </div>
  );
}

/** Máscara 1.234,56 a partir dos dígitos digitados. */
export function maskMoney(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const n = Number(digits) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Chips (`.nchips > .nch`) de seleção única ou múltipla. */
export function Chips({
  options,
  selected,
  onToggle,
  multi = true,
  icon,
}: {
  options: Array<{ value: string; label: string }>;
  selected: string | string[];
  onToggle: (value: string) => void;
  multi?: boolean;
  icon?: (value: string) => ReactNode;
}) {
  const isOn = (v: string) => (multi ? (selected as string[]).includes(v) : selected === v);
  return (
    <div className="nchips">
      {options.map((o) => {
        const on = isOn(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className={`nch ${on ? "on" : ""}`}
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
          >
            {icon ? icon(o.value) : on ? <I n="check" cls="sm" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Interruptor (`.tgl`). */
export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`tgl ${on ? "on" : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  );
}

/** Linha com título, subtítulo e interruptor (`.ntg`). */
export function ToggleRow({
  on,
  onChange,
  label,
  sub,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  sub: string;
}) {
  return (
    <div className="ntg">
      <div>
        <b>{label}</b>
        <small>{sub}</small>
      </div>
      <Toggle on={on} onChange={onChange} label={label} />
    </div>
  );
}

/** Dropdown do assistente (`.ndd`). Fecha ao clicar fora. */
export function Dropdown({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const cur = options.find((o) => o.value === value);
  return (
    <div ref={ref} className={`ndd ${open ? "open" : ""}`}>
      <button type="button" className="ndd-b" onClick={() => setOpen((o) => !o)}>
        {cur ? <span>{cur.label}</span> : <span className="ph">{placeholder}</span>}
        <I n="chev" cls="sm" />
      </button>
      <div className="ndd-p">
        <div className="ndd-l">
          {options.map((o, i) => (
            <button
              key={o.value}
              type="button"
              className={`ndd-o ${value === o.value ? "on" : ""}`}
              style={{ ["--i" as string]: i }}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
              <I n="check" cls="sm" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Lista editável (`.nl.nlbox`): "O que fazer", "O que não fazer", benefícios. */
export function ListBox({
  title,
  sub,
  placeholder,
  items,
  onChange,
  icon,
}: {
  title: string;
  sub: string;
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
  icon?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="nl nlbox">
      <div className="nl-h2">
        {icon ? (
          <span className="nli">
            <I n={icon} cls="sm" />
          </span>
        ) : null}
        <div>
          <b>{title}</b>
          <small>{sub}</small>
        </div>
      </div>
      <div className="nl-i">
        <input
          className="ni"
          placeholder={placeholder}
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="nbtn" aria-label="Adicionar" onClick={add}>
          <I n="plus" cls="sm" />
        </button>
      </div>
      {items.length ? (
        <div className="nrows">
          {items.map((x, i) => (
            <div key={`${x}-${i}`} className="nrow">
              {icon ? (
                <i className="nrk">
                  <I n={icon} cls="sm" />
                </i>
              ) : null}
              <span>{x}</span>
              <button
                type="button"
                aria-label="Remover"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <I n="x" cls="sm" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Cartão de seção (`.nbox.n2c`) com ícone, título e subtítulo. */
export function SectionCard({
  icon,
  title,
  sub,
  right,
  className = "",
  children,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`nbox n2c ${className}`.trim()}>
      <div className="nl-h2">
        <span className="nli neu">{icon}</span>
        <div>
          <b>{title}</b>
          <small>{sub}</small>
        </div>
        {right ? <span className="n2r">{right}</span> : null}
      </div>
      {children}
    </div>
  );
}
