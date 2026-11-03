import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; params?: unknown; search?: unknown; children?: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import type { AdminAlert } from "@/shared/admin-platform.types";

import { AdminAlertItem } from "./admin-alert-item";

const FULL: AdminAlert = {
  id: "1",
  code: "x",
  kind: "alert",
  severity: "critical",
  title: "Workspaces sem dono",
  description: "Existem workspaces sem dono ativo.",
  rule: "owner_id nulo",
  source: "workspaces.owner_id",
  count: 2,
  samples: [{ type: "workspace", id: 1, label: "Acme", detail: "sem dono" }],
  link: { path: "/admin/workspaces" },
};

describe("AdminAlertItem: anatomia mínima", () => {
  it("o AdminAlert completo continua mostrando gravidade, tipo, regra, origem, exemplos e 'Ver todos'", () => {
    render(<AdminAlertItem alert={FULL} sampleLink={(s) => ({ to: `/admin/${s.type}/${s.id}` })} />);
    const article = screen.getByRole("article", { name: "Workspaces sem dono" });
    expect(within(article).getByText("Crítico")).toBeInTheDocument();
    expect(within(article).getByText("Regra")).toBeInTheDocument();
    expect(within(article).getByText("Origem")).toBeInTheDocument();
    expect(within(article).getByRole("link", { name: /Acme/ })).toHaveAttribute("href", "/admin/workspace/1");
    expect(within(article).getByRole("link", { name: "Ver todos" })).toHaveAttribute("href", "/admin/workspaces");
    expect(within(article).getByText("ocorrências")).toBeInTheDocument();
  });

  it("sem severity, kind, rule e source: nada de selos nem de 'Como é calculado'", () => {
    const { container } = render(
      <AdminAlertItem alert={{ title: "Telefone duplicado", description: "Mesmo telefone em 2 criadores.", count: 1, samples: [] }} />,
    );
    expect(container.querySelector(".adm-alert-tags")).toBeNull();
    expect(screen.queryByText("Como é calculado")).not.toBeInTheDocument();
    expect(screen.getByText("ocorrência")).toBeInTheDocument();
    expect(screen.queryByText("Exemplos:")).not.toBeInTheDocument();
  });

  it("só rule: mostra a regra e não a origem", () => {
    render(<AdminAlertItem alert={{ title: "T", count: 3, rule: "regra X" }} />);
    expect(screen.getByText("Regra")).toBeInTheDocument();
    expect(screen.getByText("regra X")).toBeInTheDocument();
    expect(screen.queryByText("Origem")).not.toBeInTheDocument();
  });

  it("só source: mostra a origem e não a regra", () => {
    render(<AdminAlertItem alert={{ title: "T", count: 3, source: "tabela.coluna" }} />);
    expect(screen.getByText("Origem")).toBeInTheDocument();
    expect(screen.queryByText("Regra")).not.toBeInTheDocument();
  });

  it("só severity: um selo de gravidade, sem o de tipo", () => {
    render(<AdminAlertItem alert={{ title: "T", count: 1, severity: "warning" }} />);
    expect(screen.getByText("Atenção")).toBeInTheDocument();
  });

  it("sem count o bloco da contagem some e a grade fica de uma coluna", () => {
    const { container } = render(<AdminAlertItem alert={{ title: "T", description: "d" }} />);
    expect(container.querySelector(".adm-alert-count")).toBeNull();
    expect(container.querySelector(".adm-alert")).toHaveAttribute("data-no-count", "true");
  });

  it("count zero é um valor: aparece", () => {
    render(<AdminAlertItem alert={{ title: "T", count: 0 }} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("exemplo sem type ainda renderiza (e vira link quando sampleLink devolve destino)", () => {
    render(
      <AdminAlertItem
        alert={{ title: "T", count: 1, samples: [{ id: 7, label: "Fulana" }] }}
        sampleLink={(s) => ({ to: `/admin/creators/${s.id}` })}
      />,
    );
    expect(screen.getByRole("link", { name: "Fulana" })).toHaveAttribute("href", "/admin/creators/7");
  });
});
