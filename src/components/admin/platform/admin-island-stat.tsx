import type { ReactNode } from "react";

export type AdminIslandStatAnim = "bob" | "radar" | "rise" | "alarm" | "drop";

export interface AdminIslandStatProps {
  /** O ícone (`<I n="…" cls="sm" />` ou um desenho próprio, como o medidor de confiança). */
  icon: ReactNode;
  /** O movimento do ícone: balança (`bob`), radar (`radar`), seta que sobe (`rise`), lixeira que cai (`drop`) ou barras que respiram (`alarm`). */
  anim: AdminIslandStatAnim;
  value: string;
  label: string;
  /** Dica ao passar o mouse (a regra do número). */
  hint?: string;
  /** Acende o ícone: verde (`ok`), âmbar (`warn`) ou vermelho (`bad`). */
  tone?: "ok" | "warn" | "bad";
}

/**
 * Um número vivo na ponta direita de uma ilha (`AdminIsland`, prop `end`): ícone animado, valor e rótulo numa pílula. Os
 * números vivos de uma ilha vão juntos num `<div className="isl-live" role="group" aria-label="Agora">`.
 */
export function AdminIslandStat({ icon, anim, value, label, hint, tone }: AdminIslandStatProps) {
  return (
    <span className="isl-stat" data-anim={anim} data-tone={tone} role="status" aria-label={`${label}: ${value}`} title={hint}>
      <span className="isl-stat-ico" aria-hidden="true">
        {icon}
      </span>
      <b>{value}</b>
      <small>{label}</small>
    </span>
  );
}
