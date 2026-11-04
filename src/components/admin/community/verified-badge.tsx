import { I } from "@/components/prototype/ui";

/** Selo roxo de conta oficial. O texto fica para quem usa leitor de tela e no balão do mouse. */
export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`adm-vfy ${className}`.trim()} title="Conta oficial" role="img" aria-label="Conta oficial">
      <I n="seal" cls="sm" />
    </span>
  );
}
