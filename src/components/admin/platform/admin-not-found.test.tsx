import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, search, children, ...rest }: Record<string, unknown> & { to: string; children?: React.ReactNode }) => {
    let href = to;
    for (const [key, value] of Object.entries((params as Record<string, string>) ?? {})) href = href.replace(`$${key}`, String(value));
    const query = new URLSearchParams(Object.entries((search as Record<string, string>) ?? {}).map(([k, v]) => [k, String(v)])).toString();
    return (
      <a href={query ? `${href}?${query}` : href} {...(rest as object)}>
        {children}
      </a>
    );
  },
}));

import { AdminNotFound } from "./admin-not-found";

const css = readFileSync(resolve(__dirname, "../../../styles/admin-kit-not-found.css"), "utf8");

describe("AdminNotFound", () => {
  it("diz 'Não encontramos este <entidade>' e explica o que pode ter acontecido", () => {
    render(<AdminNotFound entity="workspace" backTo={{ to: "/admin/workspaces" }} />);
    expect(screen.getByText("Não encontramos este workspace")).toBeInTheDocument();
    expect(screen.getByText(/endereço pode estar incorreto/)).toBeInTheDocument();
  });

  it("concorda este/esta pela terminação, e `feminine` corrige as exceções", () => {
    const { unmount } = render(<AdminNotFound entity="campanha" backTo={{ to: "/admin/campaigns" }} />);
    expect(screen.getByText("Não encontramos esta campanha")).toBeInTheDocument();
    unmount();
    const second = render(<AdminNotFound entity="usuário" backTo={{ to: "/admin/users" }} />);
    expect(screen.getByText("Não encontramos este usuário")).toBeInTheDocument();
    second.unmount();
    const third = render(<AdminNotFound entity="notificação" backTo={{ to: "/admin/notifications" }} />);
    expect(screen.getByText("Não encontramos esta notificação")).toBeInTheDocument();
    third.unmount();
    const fourth = render(<AdminNotFound entity="problema" backTo={{ to: "/admin/health" }} />);
    expect(screen.getByText("Não encontramos este problema")).toBeInTheDocument();
    fourth.unmount();
    render(<AdminNotFound entity="lei" feminine backTo={{ to: "/admin/terms" }} />);
    expect(screen.getByText("Não encontramos esta lei")).toBeInTheDocument();
  });

  it("oferece UMA saída: um link de verdade para a lista, com o texto padrão ou o informado", () => {
    const { rerender } = render(<AdminNotFound entity="workspace" backTo={{ to: "/admin/workspaces" }} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para a lista" })).toHaveAttribute("href", "/admin/workspaces");
    rerender(<AdminNotFound entity="campanha" backTo={{ to: "/admin/campaigns", search: { status: "active" } }} backLabel="Voltar para campanhas" />);
    expect(screen.getByRole("link", { name: "Voltar para campanhas" })).toHaveAttribute("href", "/admin/campaigns?status=active");
  });

  it("não oferece 'Tentar de novo' (repetir a consulta não adianta) nem usa role=alert: o registro não falhou, não existe", () => {
    render(<AdminNotFound entity="usuário" backTo={{ to: "/admin/users" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/tentar de novo/i)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Não encontramos este usuário");
  });

  it("o link é alcançável pelo teclado", async () => {
    render(<AdminNotFound entity="workspace" backTo={{ to: "/admin/workspaces" }} />);
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Voltar para a lista" })).toHaveFocus();
  });

  it("description substitui a frase de apoio; boxed é o padrão e pode sair", () => {
    const { container, rerender } = render(
      <AdminNotFound entity="workspace" backTo={{ to: "/admin/workspaces" }} description="Ele foi excluído em 2 de novembro." />,
    );
    expect(screen.getByText("Ele foi excluído em 2 de novembro.")).toBeInTheDocument();
    expect(screen.queryByText(/endereço pode estar incorreto/)).not.toBeInTheDocument();
    expect(container.querySelector(".adm-state")).toHaveClass("adm-state-boxed");
    rerender(<AdminNotFound entity="workspace" backTo={{ to: "/admin/workspaces" }} boxed={false} />);
    expect(container.querySelector(".adm-state")).not.toHaveClass("adm-state-boxed");
  });

  it("o destino com parâmetros vira o href", () => {
    render(<AdminNotFound entity="grupo" backTo={{ to: "/admin/workspaces/$workspaceId/groups", params: { workspaceId: "7" } }} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/workspaces/7/groups");
  });
});

describe("CSS do 'não encontrado'", () => {
  it("alvo de toque e foco com o anel do kit, tudo sob .pv, sem sombra", () => {
    expect(css).toMatch(/min-height:\s*var\(--adm-hit\)/);
    expect(css).toMatch(/:focus-visible\s*\{[^}]*box-shadow:\s*var\(--adm-ring\)/);
    expect(css).not.toMatch(/box-shadow:\s*0/);
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/^[^\s@{}][^{}]*(?=\{)/gm) ?? [];
    selectors.forEach((selector) => expect(selector.trim()).toMatch(/^\.pv /));
  });
});
