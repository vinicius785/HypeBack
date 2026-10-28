import { Icon } from "@/components/ui/icon";

interface GroupEntryBadgeProps {
  requiredLevel: number | null;
  requiredHypePoints: number | null;
}

/**
 * Badge do requisito de entrada do grupo. Requisitos são combináveis:
 * - ambos vazios → "Aberto"
 * - nível e/ou Hype Points → exibe os dois quando presentes.
 */
export function GroupEntryBadge({
  requiredLevel,
  requiredHypePoints,
}: GroupEntryBadgeProps) {
  const hasLevel = requiredLevel != null;
  const hasHype = requiredHypePoints != null && requiredHypePoints > 0;

  if (!hasLevel && !hasHype) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <Icon name="LockOpen" size={12} color="#047857" />
        Aberto
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
      <Icon name="Lock" size={12} color="#b45309" />
      {hasLevel && <span>Nível {requiredLevel}+</span>}
      {hasLevel && hasHype && <span className="opacity-40">·</span>}
      {hasHype && <span>{requiredHypePoints} HP</span>}
    </span>
  );
}
