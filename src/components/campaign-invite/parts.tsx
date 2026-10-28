import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import type { PublicCampaignInviteData } from "@/shared/services/public-campaign-invite";

const CLOSE_MS = 300;

/** "R$ 1.200" (sem centavos quando o valor é inteiro). */
export function brl(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Valor fixo por criador, quando a campanha paga um valor definido. */
export function fixedAmount(data: PublicCampaignInviteData): number | null {
  const amount = data.payment_method_details?.amount;
  if (data.payment_method === "fixed" && amount != null && Number.isFinite(amount)) return amount;
  return null;
}

export function initialsOf(title: string): string {
  return (
    title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "HA"
  );
}

/**
 * Casca do modal de convite (protótipo `cvM`): fundo, cabeçalho, corpo e rodapé,
 * com animação de saída e fechamento por Esc.
 */
export function InviteModalShell({
  title,
  sub,
  onClose,
  body,
  foot,
}: {
  title: string;
  sub: string;
  onClose: () => void;
  body: ReactNode;
  foot: ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="pv">
      <div id="cvm" className={`pvm${closing ? " out" : ""}`}>
        <div className="ovb on" onClick={close} />
        <div className="ovw">
          <section className="ovd on cvm" role="dialog" aria-label={title}>
            <div className="sh-h cm-h">
              <div>
                <small>{sub}</small>
                <h2>{title}</h2>
              </div>
              <button type="button" className="round" onClick={close} aria-label="Fechar">
                <I n="x" cls="sm" />
              </button>
            </div>
            <div className="cvm-b">{body}</div>
            <div className="cm-f">{foot}</div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Resumo da campanha no topo dos modais (protótipo `cvCx`). */
export function InviteSummary({ data }: { data: PublicCampaignInviteData }) {
  const banner = data.banner ? getUploadUrl(data.banner) ?? undefined : undefined;
  const fixed = fixedAmount(data);
  return (
    <div className="cvm-cx">
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          flex: "none",
          overflow: "hidden",
          background: "#050505",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
        }}
      >
        {banner ? (
          <img src={banner} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          initialsOf(data.title)
        )}
      </span>
      <div>
        <b>{data.title}</b>
        <small>Convite para criadores</small>
      </div>
      {fixed != null && (
        <div className="cvm-cv">
          <b>{brl(fixed)}</b>
          <small>valor fixo</small>
        </div>
      )}
    </div>
  );
}

/** Campo de texto do modal (protótipo `cvIn`). */
export function InviteField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  prefix,
  inputMode,
  type = "text",
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  prefix?: string;
  inputMode?: "numeric" | "text" | "email";
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`cvm-fd${error ? " bad" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className={`cvm-in${prefix ? " pre" : ""}`}>
        {prefix && <span>{prefix}</span>}
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete ?? "off"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {error && <small>{error}</small>}
    </div>
  );
}

export const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());
export const isPhone = (v: string) => v.replace(/\D/g, "").length >= 10;
