import type { ReactNode } from "react";

import { EMPTY_TEXT } from "@/lib/admin/format";

import { AdminInfoPopover } from "./admin-info-popover";

import "@/styles/admin-platform.css";

export interface AdminKeyValueItem {
  label: string;
  /** `null`, `undefined` e `''` viram "—" (zero é um valor: `0` aparece). */
  value: ReactNode;
  /** Linha de apoio abaixo do valor. */
  hint?: ReactNode;
  /** "Como é calculado": aparece como o "i" ao lado do rótulo. */
  definition?: ReactNode;
}

interface AdminKeyValueListProps {
  items: readonly AdminKeyValueItem[];
  /** 2 colunas no desktop (1 no celular). Só vale em `layout="list"`. */
  columns?: 1 | 2;
  /**
   * `list` (padrão): uma linha por item, rótulo à esquerda e valor à direita, com divisores finos.
   * `strip`: faixa de itens curtos lado a lado (grade que quebra em quantas colunas couberem, sem divisores),
   * rótulo em cima e valor embaixo: a faixa do "Sistema" da Saúde.
   */
  layout?: "list" | "strip";
}

function isEmpty(value: ReactNode): boolean {
  return value === null || value === undefined || value === "" || value === false;
}

/** Rótulo/valor em lista de definição (`dl`), com divisores finos: detalhes de workspace, usuário, campanha. */
export function AdminKeyValueList({ items, columns = 1, layout = "list" }: AdminKeyValueListProps) {
  const strip = layout === "strip";
  return (
    <dl className="adm-kv" data-columns={!strip && columns === 2 ? "2" : undefined} data-layout={strip ? "strip" : undefined}>
      {items.map((item) => (
        <div className="adm-kv-row" key={item.label}>
          <dt>
            {item.label}
            {item.definition ? <AdminInfoPopover label={item.label}>{item.definition}</AdminInfoPopover> : null}
          </dt>
          <dd>
            {isEmpty(item.value) ? <span className="adm-kv-empty">{EMPTY_TEXT}</span> : item.value}
            {item.hint ? <small>{item.hint}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
