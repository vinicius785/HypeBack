import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children, ...rest }: { to: string; params?: Record<string, string>; children?: ReactNode }) => (
    <a href={params ? to.replace("$id", params.id) : to} {...rest}>
      {children}
    </a>
  ),
}));

import type { AdminAlert } from "@/shared/admin-platform.types";

import { AdminAlertItem } from "./admin-alert-item";
import { AdminEmptyState } from "./admin-empty-state";
import { adminInitials, AdminAvatar, AdminEntityCell } from "./admin-entity-cell";
import { AdminErrorState } from "./admin-error-state";
import { AdminKeyValueList } from "./admin-key-value-list";
import { AdminPageHeader } from "./admin-page-header";
import { AdminSection } from "./admin-section";
import { AdminSkeleton } from "./admin-skeleton";
import { AdminBadge, AdminStatusBadge } from "./admin-status-badge";
import { toAdminApiError } from "@/lib/admin/admin-client";

describe("AdminStatusBadge", () => {
  it.each([
    ["workspace", "active", "Ativo", "ok"],
    ["workspace", "suspended", "Suspenso", "warn"],
    ["workspace", "archived", "Arquivado", "muted"],
    ["workspace", "deleted", "Excluído", "bad"],
    ["user", "active", "Ativo", "ok"],
    ["user", "suspended", "Suspenso", "warn"],
    ["user", "deleted", "Excluído", "bad"],
    ["campaign", "draft", "Rascunho", "muted"],
    ["campaign", "published", "Publicada", "brand"],
    ["campaign", "finished", "Finalizada", undefined],
    ["severity", "critical", "Crítico", "bad"],
    ["severity", "warning", "Atenção", "warn"],
    ["severity", "info", "Informativo", undefined],
    ["activity", "active", "Com atividade", "ok"],
    ["activity", "inactive", "Sem atividade recente", "muted"],
    ["activity", "never", "Nunca teve atividade", "muted"],
    ["registration", "complete", "Completo", "ok"],
    ["registration", "incomplete", "Incompleto", "warn"],
    ["registration", "stub", "Convite não aceito", "muted"],
    ["alert-kind", "alert", "Alerta", "outline"],
    ["alert-kind", "suggestion", "Sugestão", "outline"],
    ["workspace-kind", "brand", "Marca", undefined],
    ["workspace-kind", "orphan", "Sem membros", "warn"],
  ] as const)("%s/%s → '%s'", (kind, value, label, tone) => {
    const props = { kind, value } as ComponentProps<typeof AdminStatusBadge>;
    render(<AdminStatusBadge {...props} />);
    const badge = screen.getByText(label);
    expect(badge).toHaveClass("adm-badge");
    if (tone) expect(badge).toHaveAttribute("data-tone", tone);
    else expect(badge).not.toHaveAttribute("data-tone");
  });

  it("valor novo do backend (fora do vocabulário) não quebra: texto cru em cinza", () => {
    render(<AdminStatusBadge kind="workspace" value={"paused" as never} />);
    expect(screen.getByText("paused")).toHaveAttribute("data-tone", "muted");
  });

  it("a atividade explica a janela na dica", () => {
    render(<AdminStatusBadge kind="activity" value="inactive" windowDays={30} />);
    expect(screen.getByText("Sem atividade recente")).toHaveAttribute("title", "Sem atividade há mais de 30 dias");
  });

  it("texto, dica e tamanho podem ser trocados; a etiqueta genérica aceita qualquer tom", () => {
    render(
      <>
        <AdminStatusBadge kind="workspace" value="active" label="Em dia" title="ok" size="sm" />
        <AdminBadge tone="bad">Falhou</AdminBadge>
      </>,
    );
    const custom = screen.getByText("Em dia");
    expect(custom).toHaveAttribute("title", "ok");
    expect(custom).toHaveAttribute("data-size", "sm");
    expect(screen.getByText("Falhou")).toHaveAttribute("data-tone", "bad");
  });
});

describe("AdminPageHeader", () => {
  it("título (h1), subtítulo, ações e etiquetas", () => {
    render(
      <AdminPageHeader title="Workspaces" subtitle="Clientes da plataforma" actions={<button type="button">Exportar</button>} badges={<AdminBadge>Beta</AdminBadge>} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Workspaces" })).toBeInTheDocument();
    expect(screen.getByText("Clientes da plataforma")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar" })).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("detalhe: o primeiro passo é o 'voltar' em pílula e o último sem destino é a página atual", () => {
    render(
      <AdminPageHeader title="Acme Ltda" breadcrumb={[{ label: "Workspaces", to: { to: "/admin/workspaces" } }, { label: "Acme Ltda" }]} />,
    );
    const nav = screen.getByRole("navigation", { name: "Navegação" });
    const back = within(nav).getByRole("link", { name: "Workspaces" });
    expect(back).toHaveAttribute("href", "/admin/workspaces");
    expect(back).toHaveClass("adm-crumb-back");
    expect(within(nav).getByText("Acme Ltda")).toHaveAttribute("aria-current", "page");
  });

  it("um passo só com destino é só o 'voltar', como no detalhe da campanha", () => {
    render(<AdminPageHeader title="Campanha" breadcrumb={[{ label: "Campanhas", to: { to: "/admin/campaigns" } }]} />);
    expect(screen.getByRole("link", { name: "Campanhas" })).toHaveClass("adm-crumb-back");
  });
});

describe("AdminSection", () => {
  it("cartão com título (h2) ligado à região, descrição e ações", () => {
    render(
      <AdminSection title="Membros" description="Quem acessa" actions={<button type="button">Adicionar</button>}>
        conteúdo
      </AdminSection>,
    );
    expect(screen.getByRole("region", { name: "Membros" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Membros" })).toBeInTheDocument();
    expect(screen.getByText("Quem acessa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar" })).toBeInTheDocument();
  });

  it("sem cabeçalho só envolve o conteúdo", () => {
    const { container } = render(<AdminSection flush>só conteúdo</AdminSection>);
    expect(container.querySelector(".adm-card-h")).toBeNull();
    expect(container.querySelector(".adm-card-flush")).not.toBeNull();
  });
});

describe("AdminKeyValueList", () => {
  it("lista de definição com rótulo e valor", () => {
    render(<AdminKeyValueList items={[{ label: "CNPJ", value: "12.345.678/0001-99" }, { label: "Cidade", value: "São Paulo", hint: "SP" }]} />);
    expect(screen.getByText("CNPJ").tagName).toBe("DT");
    expect(screen.getByText("12.345.678/0001-99").tagName).toBe("DD");
    expect(screen.getByText("SP")).toBeInTheDocument();
  });

  it("valor vazio vira '—', mas zero é um valor", () => {
    render(<AdminKeyValueList items={[{ label: "A", value: null }, { label: "B", value: "" }, { label: "C", value: 0 }, { label: "D", value: undefined }]} />);
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("definição ao lado do rótulo", () => {
    render(<AdminKeyValueList items={[{ label: "Atividade", value: "Ativo", definition: "Última atividade em 30 dias" }]} />);
    expect(screen.getByRole("button", { name: "Como é calculado: Atividade" })).toHaveAccessibleDescription("Última atividade em 30 dias");
  });
});

describe("AdminEntityCell", () => {
  it("iniciais ignoram símbolos soltos", () => {
    expect(adminInitials("Acme & Co")).toBe("AC");
    expect(adminInitials("maria da silva")).toBe("MD");
    expect(adminInitials("  ")).toBe("");
    expect(adminInitials("João")).toBe("J");
    expect(adminInitials("- ★ -")).toBe("");
  });

  it("sem foto mostra as iniciais; nome e apoio ficam em texto", () => {
    render(<AdminEntityCell name="Acme Ltda" subtitle="dono@acme.com" />);
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByText("Acme Ltda")).toBeInTheDocument();
    expect(screen.getByText("dono@acme.com")).toBeInTheDocument();
  });

  it("com foto absoluta usa a imagem (decorativa: alt vazio)", () => {
    const { container } = render(<AdminEntityCell name="Acme" photo="https://cdn.test/a.png" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://cdn.test/a.png");
    expect(img).toHaveAttribute("alt", "");
  });

  it("foto relativa é resolvida na base do servidor (sem o /api/backoffice)", () => {
    vi.stubEnv("VITE_SERVER_URL", "https://api.test/api/backoffice");
    const { container } = render(<AdminEntityCell name="Acme" photo="/uploads/a.png" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://api.test/uploads/a.png");
    vi.unstubAllEnvs();
  });

  it("foto relativa sem VITE_SERVER_URL não derruba a tela: cai nas iniciais", () => {
    vi.stubEnv("VITE_SERVER_URL", "");
    const { container } = render(<AdminEntityCell name="Acme" photo="/uploads/a.png" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("A")).toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});

describe("AdminAvatar", () => {
  it("só a foto ou as iniciais, sem o nome (o nome já está no título da página); decorativo para leitor de tela", () => {
    const { container } = render(<AdminAvatar name="Acme Cosméticos Ltda" shape="square" size={64} />);
    const avatar = container.querySelector(".adm-entity-av") as HTMLElement;
    expect(avatar).toHaveTextContent("AC");
    expect(avatar).toHaveAttribute("data-shape", "square");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar.style.width).toBe("64px");
    expect(screen.queryByText("Acme Cosméticos Ltda")).not.toBeInTheDocument();
  });

  it("foto que quebra volta para as iniciais", () => {
    const { container } = render(<AdminAvatar name="Beta Moda" photo="https://cdn.test/quebrada.png" />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("BM")).toBeInTheDocument();
  });

  it("serve de `leading` do cabeçalho de detalhe", () => {
    render(<AdminPageHeader title="Acme" leading={<AdminAvatar name="Acme" shape="square" size={64} />} />);
    expect(screen.getByRole("heading", { level: 1, name: "Acme" })).toBeInTheDocument();
    expect(document.querySelector(".adm-head-lead .adm-entity-av")).toHaveTextContent("A");
  });
});

describe("AdminAlertItem", () => {
  const alert: AdminAlert = {
    id: "a1",
    code: "WITHDRAWAL_STUCK",
    kind: "alert",
    severity: "critical",
    title: "Saques parados há mais de 3 dias",
    description: "Pedidos de saque pendentes sem transferência.",
    rule: "influencer_withdrawals.status = 'pending' e created_at < agora - 3 dias",
    source: "influencer_withdrawals",
    count: 3,
    samples: [
      { type: "user", id: 42, label: "Ana Souza", detail: "R$ 150,00" },
      { type: "user", id: 43, label: "Bia Lima" },
    ],
    link: { path: "/admin/financial", query: { type: "withdrawal" } },
  };

  it("gravidade, tipo, título, descrição e contagem", () => {
    render(<AdminAlertItem alert={alert} />);
    expect(screen.getByText("Crítico")).toBeInTheDocument();
    expect(screen.getByText("Alerta")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Saques parados há mais de 3 dias" })).toBeInTheDocument();
    expect(screen.getByText("Pedidos de saque pendentes sem transferência.")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("ocorrências")).toBeInTheDocument();
  });

  it("singular para uma ocorrência", () => {
    render(<AdminAlertItem alert={{ ...alert, count: 1 }} />);
    expect(screen.getByText("ocorrência")).toBeInTheDocument();
  });

  it("a regra exata e a origem ficam em 'Como é calculado'", () => {
    render(<AdminAlertItem alert={alert} />);
    expect(screen.getByText("Como é calculado")).toBeInTheDocument();
    expect(screen.getByText(/influencer_withdrawals.status = 'pending'/)).toBeInTheDocument();
    expect(screen.getByText("influencer_withdrawals")).toBeInTheDocument();
  });

  it("exemplos como texto, ou como links quando a tela diz para onde levam", () => {
    const { rerender } = render(<AdminAlertItem alert={alert} />);
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ana Souza/ })).not.toBeInTheDocument();

    rerender(<AdminAlertItem alert={alert} sampleLink={(s) => ({ to: "/admin/users/$id", params: { id: String(s.id) } })} />);
    expect(screen.getByRole("link", { name: /Ana Souza/ })).toHaveAttribute("href", "/admin/users/42");
  });

  it("'Ver todos' leva para o link do contrato", () => {
    render(<AdminAlertItem alert={alert} />);
    expect(screen.getByRole("link", { name: "Ver todos" })).toHaveAttribute("href", "/admin/financial");
  });

  it("sem link nem exemplos, não mostra 'Ver todos' nem 'Exemplos'", () => {
    render(<AdminAlertItem alert={{ ...alert, link: null, samples: [] }} />);
    expect(screen.queryByRole("link", { name: "Ver todos" })).not.toBeInTheDocument();
    expect(screen.queryByText("Exemplos:")).not.toBeInTheDocument();
  });

  it("sugestão (heurística) é marcada como tal", () => {
    render(<AdminAlertItem alert={{ ...alert, kind: "suggestion", severity: "info" }} />);
    expect(screen.getByText("Sugestão")).toBeInTheDocument();
    expect(screen.getByText("Informativo")).toBeInTheDocument();
  });
});

describe("estados e esqueleto", () => {
  it("estado vazio: título, descrição, ação e sem ícone por padrão", () => {
    const { container } = render(<AdminEmptyState title="Nada aqui" description="Tente de novo" action={<button type="button">Limpar</button>} />);
    expect(screen.getByRole("status")).toHaveTextContent("Nada aqui");
    expect(screen.getByText("Tente de novo")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("erro: título conforme o tipo de falha e retry só quando adianta", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<AdminErrorState error={toAdminApiError(404, { message: "Cannot GET /x" })} onRetry={onRetry} />);
    expect(screen.getByText("Recurso indisponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBeInTheDocument();

    rerender(<AdminErrorState error={toAdminApiError(404, { message: "Workspace não encontrado" })} onRetry={onRetry} />);
    expect(screen.getByText("Não encontrado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tentar de novo/ })).not.toBeInTheDocument();

    rerender(<AdminErrorState error={toAdminApiError(403, { message: "Forbidden resource" })} onRetry={onRetry} />);
    expect(screen.getByText("Sem permissão")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tentar de novo/ })).not.toBeInTheDocument();

    rerender(<AdminErrorState error={new Error("x")} title="Falhou" message="Algo deu errado" onRetry={onRetry} retrying />);
    expect(screen.getByText("Falhou")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tentando/ })).toBeDisabled();
  });

  it("esqueleto é decorativo (aria-hidden)", () => {
    const { container } = render(<AdminSkeleton width={120} height={12} />);
    const sk = container.querySelector(".adm-sk") as HTMLElement;
    expect(sk).toHaveAttribute("aria-hidden", "true");
    expect(sk.style.width).toBe("120px");
  });
});
