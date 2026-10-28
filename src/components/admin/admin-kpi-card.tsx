import { I } from "@/components/prototype/ui";

interface AdminKpiCardProps {
  label: string;
  /** Valor já formatado (ex.: "R$ 182,5 mil" ou "4.820"). */
  value: string | number | null | undefined;
  /** Linha de apoio ao lado/abaixo do valor. */
  hint?: string;
  /** Nome de ícone do protótipo (ver `components/prototype/ui.tsx`). */
  icon?: string;
  /** Posição, para o atraso da animação de entrada. */
  index?: number;
  isLoading?: boolean;
}

export function AdminKpiCard({
  label,
  value,
  hint,
  icon = "chart",
  index = 0,
  isLoading,
}: AdminKpiCardProps) {
  return (
    <div
      className="adx-k"
      style={{ "--k": index } as React.CSSProperties}
    >
      <span className="adx-ki">
        <I n={icon} cls="sm" />
      </span>
      <small>{label}</small>
      <b style={isLoading ? { opacity: 0.35 } : undefined}>
        {isLoading ? "—" : (value ?? "—")}
      </b>
      <div>{hint ? <span>{hint}</span> : null}</div>
    </div>
  );
}
