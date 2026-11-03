import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/**
 * Destino de navegação dentro do Admin, em forma de dado: serve a linhas de tabela, cartões de número e
 * alertas sem acoplar o componente à árvore de rotas tipada (as rotas novas só entram nos tipos depois
 * que o gerador roda). `to` é o caminho do app (`/admin/workspaces/$workspaceId`), sem o `/backoffice`.
 */
export interface AdminLinkTarget {
  to: string;
  params?: Record<string, string | number>;
  search?: Record<string, unknown>;
}

/** O contrato descreve links como `{ path, query }` (ex.: `AdminAlert.link`). */
export function adminLinkFromContract(link: {
  path: string;
  query?: Record<string, string>;
}): AdminLinkTarget {
  return { to: link.path, search: link.query };
}

// O destino vem de dados e não pode ser conferido contra as rotas em tempo de compilação: o `Link` tipado
// do TanStack é usado com um contrato frouxo, só aqui.
const LooseLink = Link as unknown as ComponentType<
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    params?: Record<string, string | number>;
    search?: Record<string, unknown>;
  }
>;

type AdminLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> & {
  /** Destino como dado (ou só o caminho: `to="/admin/workspaces"`). */
  to: AdminLinkTarget | string;
  /** Ausente em links "esticados" (cartão inteiro clicável) que só levam `aria-label`. */
  children?: ReactNode;
  /** Link de texto do kit (`adm-textlink`): sublinhado fino, anel de foco e alvo de toque. Soma-se ao `className`. */
  textLink?: boolean;
};

/** `<Link>` do TanStack com o destino como dado: o `href` real permite abrir em nova aba e o clique comum navega no SPA. */
export function AdminLink({ to, children, textLink, className, ...anchor }: AdminLinkProps) {
  const target: AdminLinkTarget = typeof to === "string" ? { to } : to;
  const classes = textLink ? (className ? `adm-textlink ${className}` : "adm-textlink") : className;
  return (
    <LooseLink to={target.to} params={target.params} search={target.search} className={classes} {...anchor}>
      {children}
    </LooseLink>
  );
}
