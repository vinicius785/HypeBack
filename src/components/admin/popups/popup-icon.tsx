import { icons } from "lucide-react";

function pascal(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Desenha o ícone que a API nomeia (`gift`, `trophy`…) com a biblioteca de ícones do painel; nome desconhecido vira um círculo. */
export function PopupIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Glyph = (icons as Record<string, (typeof icons)[keyof typeof icons]>)[pascal(name)] ?? icons.Circle;
  return <Glyph size={size} aria-hidden="true" />;
}
