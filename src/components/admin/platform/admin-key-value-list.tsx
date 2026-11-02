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
  /** 2 colunas no desktop (1 no celular). */
  columns?: 1 | 2;
}

function isEmpty(value: ReactNode): boolean {
  return value === null || value === undefined || value === "" || value === false;
}

/** Rótulo/valor em lista de definição (`dl`), com divisores finos: detalhes de workspace, usuário, campanha. */
export function AdminKeyValueList({ items, columns = 1 }: AdminKeyValueListProps) {
  return (
    <dl className="adm-kv" data-columns={columns === 2 ? "2" : undefined}>
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
