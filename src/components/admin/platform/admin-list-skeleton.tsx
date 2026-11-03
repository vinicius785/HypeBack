import { AdminSkeleton } from "./admin-skeleton";

import "@/styles/admin-platform.css";
import "@/styles/admin-kit-list-skeleton.css";

export type AdminListSkeletonVariant = "rows" | "timeline" | "alerts" | "strip";

interface AdminListSkeletonProps {
  /** Quantas linhas de esqueleto (1 a 30). Padrão 5. Ignorado em `strip`. */
  rows?: number;
  /**
   * O desenho de cada linha, igual ao da lista que vai chegar:
   * - `rows`: título + apoio à esquerda e um número à direita (lista de movimentações, auditoria);
   * - `timeline`: ponto + frase + meta e a hora à direita (linha do tempo);
   * - `alerts`: um selo + título + descrição e a contagem à direita (alertas da saúde);
   * - `strip`: uma faixa de 4 itens curtos lado a lado (rótulo + valor), como o Sistema da Saúde. Desenha sempre a
   *   mesma faixa: `rows` não vale para este desenho.
   */
  variant?: AdminListSkeletonVariant;
  /** O que o leitor de tela ouve ("Carregando alertas…"). Padrão: "Carregando…". */
  ariaLabel?: string;
}

const MAX_ROWS = 30;

/** Larguras diferentes por linha: parece texto de verdade, e é a mesma em toda renderização (sem `Math.random`). */
const widthFor = (index: number, start: number, step: number) => `${start - (index % 3) * step}%`;

function RowSkeleton({ index }: { index: number }) {
  return (
    <div className="adm-lsk-row">
      <div className="adm-lsk-main">
        <AdminSkeleton height={16} width={widthFor(index, 58, 9)} />
        <AdminSkeleton height={12} width={widthFor(index, 38, 5)} />
      </div>
      <AdminSkeleton height={16} width={72} />
    </div>
  );
}

function TimelineSkeleton({ index }: { index: number }) {
  return (
    <div className="adm-lsk-row">
      <AdminSkeleton className="adm-lsk-dot" width={10} height={10} radius="50%" />
      <div className="adm-lsk-main">
        <AdminSkeleton height={15} width={widthFor(index, 74, 12)} />
        <AdminSkeleton height={12} width={widthFor(index, 40, 6)} />
      </div>
      <AdminSkeleton height={13} width={40} />
    </div>
  );
}

function AlertSkeleton({ index }: { index: number }) {
  return (
    <div className="adm-lsk-row">
      <div className="adm-lsk-main">
        <div className="adm-lsk-tags">
          <AdminSkeleton height={22} width={72} radius={999} />
        </div>
        <AdminSkeleton height={16} width={widthFor(index, 52, 8)} />
        <AdminSkeleton height={12} width="72%" />
      </div>
      <AdminSkeleton height={32} width={44} />
    </div>
  );
}

const STRIP_ITEMS = 4;

function StripSkeleton() {
  return (
    <div className="adm-lsk-strip">
      {Array.from({ length: STRIP_ITEMS }, (_, index) => (
        <div className="adm-lsk-cell" key={index}>
          <AdminSkeleton height={12} width={widthFor(index, 52, 8)} />
          <AdminSkeleton height={20} width={widthFor(index, 70, 10)} />
        </div>
      ))}
    </div>
  );
}

const ROW_BY_VARIANT = {
  rows: RowSkeleton,
  timeline: TimelineSkeleton,
  alerts: AlertSkeleton,
} as const;

/**
 * Esqueleto de lista: o que aparece enquanto a primeira página carrega. Substitui os esqueletos que cada tela
 * desenhava à mão (atividade, auditoria, alertas, movimentações).
 *
 * - leitor de tela: UMA região `role="status"` com o texto "Carregando…" (só ele é lido; os blocos são decorativos
 *   e ficam fora da árvore de acessibilidade). Não usa `aria-busy` na região: alguns leitores calam uma região viva
 *   marcada como ocupada;
 * - o texto fica em `.adm-sr` (absoluto); a região é `position: relative` e serve de âncora, em qualquer lugar;
 * - movimento: a pulsação sai com `prefers-reduced-motion` (o bloco fica chapado).
 */
export function AdminListSkeleton({ rows = 5, variant = "rows", ariaLabel = "Carregando…" }: AdminListSkeletonProps) {
  const count = Math.min(MAX_ROWS, Math.max(1, Math.floor(Number.isFinite(rows) ? rows : 5)));
  return (
    <div className="adm-lsk" data-variant={variant} role="status">
      <span className="adm-sr">{ariaLabel}</span>
      {variant === "strip"
        ? <StripSkeleton />
        : Array.from({ length: count }, (_, index) => {
            const Row = ROW_BY_VARIANT[variant];
            return <Row key={index} index={index} />;
          })}
    </div>
  );
}
