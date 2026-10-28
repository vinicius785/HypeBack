/** Bloco de placeholder animado. Usado nos skeletons de carregamento de cada aba. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className ?? ""}`} aria-hidden />;
}
