import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; params?: unknown; search?: unknown; children?: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import { AdminLink } from "./admin-link";

describe("AdminLink: textLink", () => {
  it("sem textLink não ganha classe nenhuma", () => {
    render(<AdminLink to="/admin/x">Ver</AdminLink>);
    expect(screen.getByRole("link", { name: "Ver" })).not.toHaveAttribute("class");
  });

  it("textLink põe adm-textlink e preserva o className recebido", () => {
    render(
      <>
        <AdminLink to="/admin/x" textLink>
          Um
        </AdminLink>
        <AdminLink to="/admin/x" textLink className="extra">
          Dois
        </AdminLink>
        <AdminLink to="/admin/x" className="so-esta">
          Três
        </AdminLink>
      </>,
    );
    expect(screen.getByRole("link", { name: "Um" })).toHaveClass("adm-textlink");
    expect(screen.getByRole("link", { name: "Dois" })).toHaveClass("adm-textlink", "extra");
    expect(screen.getByRole("link", { name: "Três" })).toHaveClass("so-esta");
    expect(screen.getByRole("link", { name: "Três" })).not.toHaveClass("adm-textlink");
  });
});
