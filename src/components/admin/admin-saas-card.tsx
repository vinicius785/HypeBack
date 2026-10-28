interface AdminSaasCardProps {
  name: string;
  value: string;
  description: string;
  /** "ok" (verde) e "mid" (âmbar) colorem o selo; vazio = neutro. */
  tone?: "ok" | "mid" | "";
  index?: number;
  isLoading?: boolean;
}

/** Linha de "Saúde do negócio" (`.adx-hr`). */
export function AdminSaasCard({
  name,
  value,
  description,
  tone = "",
  index = 0,
  isLoading,
}: AdminSaasCardProps) {
  return (
    <div className="adx-hr" style={{ "--k": index } as React.CSSProperties}>
      <div>
        <b>{name}</b>
        <small>{description}</small>
      </div>
      <strong className={isLoading ? "" : tone}>{isLoading ? "—" : value}</strong>
    </div>
  );
}
