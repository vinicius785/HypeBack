import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  pathname: "/",
  status: undefined as string | undefined,
  hasWorkspace: true,
}));

vi.mock("@tanstack/react-router", () => ({ useLocation: () => ({ pathname: ctx.pathname }) }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({
    selectedWorkspace: ctx.hasWorkspace ? { id: "w1", name: "Acme", status: ctx.status } : undefined,
  }),
}));
vi.mock("./workspace-suspended-state", () => ({ WorkspaceSuspendedState: () => <div data-testid="bloqueio" /> }));

import { WorkspaceStateContent, WorkspaceStateTop } from "./workspace-state-slots";

function Page() {
  return (
    <>
      <WorkspaceStateTop>
        <header data-testid="topo" />
      </WorkspaceStateTop>
      <main>
        <WorkspaceStateContent>
          <div data-testid="pagina" />
        </WorkspaceStateContent>
      </main>
    </>
  );
}

beforeEach(() => {
  ctx.pathname = "/";
  ctx.status = "active";
  ctx.hasWorkspace = true;
});

describe("workspace ativo", () => {
  it("nada muda: topo e página normais, sem faixa nem bloqueio", () => {
    render(<Page />);
    expect(screen.getByTestId("topo")).toBeInTheDocument();
    expect(screen.getByTestId("pagina")).toBeInTheDocument();
    expect(screen.queryByTestId("bloqueio")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("servidor antigo (sem estado) e sem workspace selecionado também seguem normais", () => {
    ctx.status = undefined;
    const { unmount } = render(<Page />);
    expect(screen.getByTestId("pagina")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    unmount();

    ctx.hasWorkspace = false;
    render(<Page />);
    expect(screen.getByTestId("topo")).toBeInTheDocument();
    expect(screen.getByTestId("pagina")).toBeInTheDocument();
  });
});

describe("workspace arquivado", () => {
  beforeEach(() => {
    ctx.status = "archived";
  });

  it("entra a faixa 'somente consulta' e todo o resto segue (a leitura funciona)", () => {
    render(<Page />);
    expect(screen.getByRole("status")).toHaveTextContent("Workspace arquivado — somente consulta");
    expect(screen.getByTestId("topo")).toBeInTheDocument();
    expect(screen.getByTestId("pagina")).toBeInTheDocument();
    expect(screen.queryByTestId("bloqueio")).not.toBeInTheDocument();
  });

  it("a faixa fica logo abaixo do topo, fora da área da página", () => {
    render(<Page />);
    const topo = screen.getByTestId("topo");
    const faixa = screen.getByRole("status");
    expect(topo.compareDocumentPosition(faixa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("main")).not.toContainElement(faixa);
  });

  it("Meu perfil é da conta, não do workspace: sem faixa", () => {
    ctx.pathname = "/settings";
    render(<Page />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByTestId("pagina")).toBeInTheDocument();
  });
});

describe("workspace suspenso", () => {
  beforeEach(() => {
    ctx.status = "suspended";
  });

  it("a página some atrás do bloqueio e o topo (sino e chat, que chamam a API) não monta", () => {
    render(<Page />);
    expect(screen.getByTestId("bloqueio")).toBeInTheDocument();
    expect(screen.queryByTestId("pagina")).not.toBeInTheDocument();
    expect(screen.queryByTestId("topo")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("vale em qualquer rota do workspace (detalhe de campanha, configurações do workspace)", () => {
    for (const pathname of ["/campaigns/abc", "/workspace/settings", "/financial"]) {
      ctx.pathname = pathname;
      const { unmount } = render(<Page />);
      expect(screen.getByTestId("bloqueio")).toBeInTheDocument();
      expect(screen.queryByTestId("pagina")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("Meu perfil segue aberto (é da conta, não chama a API do workspace); o topo continua de fora", () => {
    ctx.pathname = "/settings";
    render(<Page />);
    expect(screen.getByTestId("pagina")).toBeInTheDocument();
    expect(screen.queryByTestId("bloqueio")).not.toBeInTheDocument();
    expect(screen.queryByTestId("topo")).not.toBeInTheDocument();
  });
});
