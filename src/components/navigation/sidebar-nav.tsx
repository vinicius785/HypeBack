import { I } from "@/components/prototype/ui";
import { useScrollEdges } from "@/hooks/admin/use-scroll-edges";

import type { VisibleNavSection } from "./nav-config";

/**
 * Vez de cada título e item na cascata de entrada do menu (CSS `--i`, ver `admin-sidebar-motion.css`): os títulos
 * e os itens seguem um ao outro na ordem em que aparecem.
 */
export interface NavCascade {
  positions: ReadonlyArray<{ head: number; items: readonly number[] }>;
  /** A vez que vem depois do último item ("Voltar ao app" fecha a sequência). */
  total: number;
}

export function cascadeOf(sections: readonly VisibleNavSection[]): NavCascade {
  let i = 0;
  const positions = sections.map((section) => ({ head: i++, items: section.items.map(() => i++) }));
  return { positions, total: i };
}

interface SidebarNavProps {
  sections: readonly VisibleNavSection[];
  isOn: (href: string) => boolean;
  onNavigate: (href: string) => void;
  ariaLabel: string;
  /** Presente só quando o menu entra animado (Admin, ou o app que chega do Admin). */
  cascade?: NavCascade | null;
}

/**
 * Lista de navegação do menu lateral: grupos com título discreto, divisória sutil entre grupos e itens com a
 * mesma estrutura. Serve aos dois ambientes; o que aparece vem da configuração (`nav-config.ts`).
 *
 * No trilho (≤ 1100px) os títulos somem, um fio separa os grupos e o nome do item vem na dica
 * (`data-tip`, ver `useRailTooltip`). O selo de campanhas ativas vira um número pequeno sobre o ícone.
 */
export function SidebarNav({ sections, isOn, onNavigate, ariaLabel, cascade }: SidebarNavProps) {
  // A lista rola quando é mais alta que a tela; a linha fina na borda mostra que ela continua.
  const { ref, edges } = useScrollEdges<HTMLElement>();

  return (
    <nav
      ref={ref}
      className="nav sb-nav"
      aria-label={ariaLabel}
      data-more-before={edges.before ? "true" : undefined}
      data-more-after={edges.after ? "true" : undefined}
    >
      {sections.map((section, si) => (
        <div key={section.id} className="sb-group" role="group" aria-labelledby={`sb-nav-${section.id}`}>
          <h6 id={`sb-nav-${section.id}`} style={cascade ? { ["--i" as string]: cascade.positions[si].head } : undefined}>
            {section.label}
          </h6>
          {section.items.map((item, ii) => {
            const on = isOn(item.href);
            // Segurança com alerta novo: o item inteiro fica vermelho (como o roxo do item selecionado, só que vermelho)
            const alert = item.badge === "securityAlerts" && !!item.count;
            return (
              <button
                key={item.id}
                type="button"
                className={`sb-item${on ? " on" : ""}`}
                data-alert={alert ? "true" : undefined}
                aria-label={item.count ? `${item.label} (${item.count})` : item.label}
                aria-current={on ? "page" : undefined}
                data-tip={item.label}
                style={cascade ? { ["--i" as string]: cascade.positions[si].items[ii] } : undefined}
                onClick={() => onNavigate(item.href)}
              >
                <I n={item.icon} />
                <span>{item.label}</span>
                {item.count ? <b className="n">{item.count}</b> : null}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
