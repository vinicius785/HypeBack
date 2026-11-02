import type { ReactNode } from "react";

import { I } from "@/components/prototype/ui";
import { useAdminDocumentTitle } from "@/hooks/admin/use-admin-document-title";

import { AdminLink, type AdminLinkTarget } from "./admin-link";

import "@/styles/admin-platform.css";

/** Um passo das migalhas. Com `to` vira link; sem `to` é a página atual. */
export interface AdminCrumb {
  label: string;
  to?: AdminLinkTarget;
}

interface AdminPageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Botões da página (alinhados à direita; no celular ocupam a linha inteira). */
  actions?: ReactNode;
  /**
   * Páginas de detalhe: o primeiro passo com `to` aparece como o "voltar" em pílula do detalhe da campanha
   * (`[{ label: 'Workspaces', to }]` basta); passos seguintes viram texto, e o último sem `to` é a página atual.
   */
  breadcrumb?: readonly AdminCrumb[];
  /** Etiquetas ao lado do título (estado do workspace, do usuário…). */
  badges?: ReactNode;
  /** Foto/avatar à esquerda do título (`<AdminAvatar name shape size={64} />`; o nome já está no título). */
  leading?: ReactNode;
  /** Linha de apoio abaixo do subtítulo (identificadores, datas). */
  meta?: ReactNode;
}

function AdminBreadcrumb({ items }: { items: readonly AdminCrumb[] }) {
  return (
    <nav className="adm-crumb" aria-label="Navegação">
      <ol>
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`}>
            {index > 0 ? (
              <span className="adm-crumb-sep" aria-hidden="true">
                <I n="chev" cls="sm" />
              </span>
            ) : null}
            {item.to ? (
              <AdminLink to={item.to} className={index === 0 ? "adm-crumb-back" : undefined}>
                {index === 0 ? <I n="back" cls="sm" /> : null}
                {item.label}
              </AdminLink>
            ) : (
              <span className="adm-crumb-cur" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Título da página do Admin (32px), subtítulo, ações à direita e, nas páginas de detalhe, o "voltar". */
export function AdminPageHeader({ title, subtitle, actions, breadcrumb, badges, leading, meta }: AdminPageHeaderProps) {
  // Título da aba do navegador: o do cabeçalho quando é texto (nome da página ou do registro); esqueleto não conta.
  useAdminDocumentTitle(typeof title === "string" ? title : undefined);
  return (
    <header className="adm-head">
      {breadcrumb && breadcrumb.length > 0 ? <AdminBreadcrumb items={breadcrumb} /> : null}
      <div className="adm-head-row">
        <div className="adm-head-main">
          {leading ? <div className="adm-head-lead">{leading}</div> : null}
          <div className="adm-head-text">
            <div className="adm-head-title">
              <h1>{title}</h1>
              {badges}
            </div>
            {subtitle ? <p className="adm-head-sub">{subtitle}</p> : null}
            {meta ? <div className="adm-head-meta">{meta}</div> : null}
          </div>
        </div>
        {actions ? <div className="adm-head-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
