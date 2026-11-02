import type { CSSProperties } from "react";

import "@/styles/admin-platform.css";

interface AdminSkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
}

/** Bloco de carregamento: cor chapada que pulsa (sem gradiente). Decorativo: fica fora da árvore de acessibilidade. */
export function AdminSkeleton({ width = "100%", height = 14, radius, className = "", style }: AdminSkeletonProps) {
  return (
    <span
      className={`adm-sk ${className}`.trim()}
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

/** Algumas linhas de texto em carregamento; a última é mais curta. */
export function AdminSkeletonLines({ lines = 3, lastWidth = "60%" }: { lines?: number; lastWidth?: string }) {
  return (
    <span className="adm-sk-lines" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <AdminSkeleton key={i} height={12} width={i === lines - 1 && lines > 1 ? lastWidth : "100%"} />
      ))}
    </span>
  );
}
