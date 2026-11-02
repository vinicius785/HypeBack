import { render, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AdminPageHeader } from "@/components/admin/platform";

import { adminDocumentTitle, useAdminDocumentTitle } from "./use-admin-document-title";

beforeEach(() => {
  document.title = "Hypeapp";
});

describe("adminDocumentTitle", () => {
  it("'<página> · Admin · HypeApp'", () => {
    expect(adminDocumentTitle("Workspaces")).toBe("Workspaces · Admin · HypeApp");
    expect(adminDocumentTitle("  Café Serra Verde ")).toBe("Café Serra Verde · Admin · HypeApp");
    expect(adminDocumentTitle("")).toBe("Admin · HypeApp");
  });
});

describe("useAdminDocumentTitle", () => {
  it("define o título e devolve o anterior ao desmontar", () => {
    const { unmount } = renderHook(() => useAdminDocumentTitle("Workspaces"));
    expect(document.title).toBe("Workspaces · Admin · HypeApp");
    unmount();
    expect(document.title).toBe("Hypeapp");
  });

  it("troca o título quando a página muda (lista -> detalhe com o nome do registro) e restaura ao fim", () => {
    const { rerender, unmount } = renderHook(({ title }: { title?: string }) => useAdminDocumentTitle(title), {
      initialProps: { title: undefined as string | undefined },
    });
    expect(document.title).toBe("Hypeapp");

    rerender({ title: "Café Serra Verde" });
    expect(document.title).toBe("Café Serra Verde · Admin · HypeApp");
    rerender({ title: "Outro Cliente" });
    expect(document.title).toBe("Outro Cliente · Admin · HypeApp");

    unmount();
    expect(document.title).toBe("Hypeapp");
  });

  it("não desfaz o título de uma página que já assumiu depois (navegação lista -> detalhe)", () => {
    const list = renderHook(() => useAdminDocumentTitle("Workspaces"));
    const detail = renderHook(() => useAdminDocumentTitle("Café Serra Verde"));
    list.unmount();
    expect(document.title).toBe("Café Serra Verde · Admin · HypeApp");
    detail.unmount();
    expect(document.title).toBe("Hypeapp");
  });
});

describe("AdminPageHeader", () => {
  it("usa o próprio título como título da aba, e o esqueleto de carregamento não mexe", () => {
    const { rerender, unmount } = render(<AdminPageHeader title={<span>carregando</span>} />);
    expect(document.title).toBe("Hypeapp");

    rerender(<AdminPageHeader title="Usuários" />);
    expect(document.title).toBe("Usuários · Admin · HypeApp");

    unmount();
    expect(document.title).toBe("Hypeapp");
  });
});
