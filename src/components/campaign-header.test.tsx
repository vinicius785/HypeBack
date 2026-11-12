import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CampaignHeader, type CampaignHeaderProps } from "./campaign-header";

beforeEach(() => {
  vi.stubEnv("VITE_SERVER_URL", "https://api.test/api/backoffice");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function setup(props: Partial<CampaignHeaderProps> = {}) {
  const handlers = {
    onPublish: vi.fn(),
    onUnpublish: vi.fn(),
    onCheckPublications: vi.fn(),
    onEdit: vi.fn(),
    onOpenInvite: vi.fn(),
    onShare: vi.fn(),
  };
  const view = render(
    <CampaignHeader
      title="Speediance Gym Monster 3S — Sua Academia"
      description="Apresentar o produto ao público brasileiro"
      status="published"
      statusLabel="Publicado"
      canWrite
      checking={false}
      hasPublished
      {...handlers}
      {...props}
    >
      <nav data-testid="tabs" />
    </CampaignHeader>,
  );
  return { ...view, ...handlers };
}

const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Mais ações da campanha" }));

describe("CampaignHeader: menu ⋯ (Editar e Excluir)", () => {
  it("Editar e Excluir ficam dentro do menu, não soltos no cartão", () => {
    setup({ canDelete: true, onDelete: vi.fn() });
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Excluir/ })).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
    openMenu();
    expect(screen.getByRole("menuitem", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Excluir/ })).toBeInTheDocument();
  });

  it("mostra Excluir só com permissão e com a ação ligada; o clique chama onDelete e fecha o menu", () => {
    const onDelete = vi.fn();
    const { unmount } = setup({ canDelete: true, onDelete });
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Excluir/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    unmount();

    setup({ canDelete: false, onDelete });
    openMenu();
    expect(screen.queryByRole("menuitem", { name: /Excluir/ })).not.toBeInTheDocument();
  });

  it("Editar chama onEdit; Esc e clique fora fecham o menu", () => {
    const { onEdit } = setup();
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledTimes(1);

    openMenu();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    openMenu();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("sem nenhuma permissão o menu só tem Compartilhar (sem Editar nem Excluir)", () => {
    setup({ canWrite: false, canDelete: false });
    openMenu();
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Compartilhar"]);
  });

  it("Compartilhar mora no menu ⋯ (não solto no cartão); o clique chama onShare e fecha o menu", () => {
    const { onShare } = setup();
    expect(screen.queryByRole("button", { name: "Compartilhar" })).toBeNull();
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Compartilhar" }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("CampaignHeader: Verificar publicações", () => {
  it("só aparece quando há criador na etapa Publicado", () => {
    const { unmount } = setup({ hasPublished: false });
    expect(screen.queryByRole("button", { name: "Verificar publicações" })).toBeNull();
    unmount();
    setup({ hasPublished: true });
    expect(screen.getByRole("button", { name: "Verificar publicações" })).toBeInTheDocument();
  });
});

describe("CampaignHeader", () => {
  it("mostra o banner pela URL de uploads e as abas dentro do cartão", () => {
    const { container } = setup({ banner: "/uploads/campaigns/speediance.png" });
    expect(container.querySelector(".chd-cover img")).toHaveAttribute(
      "src",
      "https://api.test/uploads/campaigns/speediance.png",
    );
    expect(container.querySelector(".chd")).toContainElement(screen.getByTestId("tabs"));
  });

  it("usa as iniciais do título sem banner ou quando ele não carrega", () => {
    const { container } = setup({ banner: "/uploads/campaigns/speediance.png" });
    fireEvent.error(container.querySelector(".chd-cover img")!);
    expect(container.querySelector(".chd-cover img")).toBeNull();
    expect(container.querySelector(".chd-ph")).toHaveTextContent("SG");
  });

  it("o status é um seletor: abre um menu de opções (sem popup) e escolher a outra opção despublica/publica", () => {
    const { onUnpublish, unmount } = setup();
    const trigger = screen.getByRole("button", { name: "Publicado" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    const list = screen.getByRole("listbox", { name: "Status da campanha" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: "Publicado" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Rascunho" })).toHaveAttribute("aria-selected", "false");
    expect(onUnpublish).not.toHaveBeenCalled(); // só abrir o menu não dispara nada
    fireEvent.click(screen.getByRole("option", { name: "Rascunho" }));
    expect(onUnpublish).toHaveBeenCalledTimes(1);
    expect(list).not.toBeInTheDocument();
    unmount();

    const { onPublish } = setup({ status: "draft", statusLabel: "Rascunho" });
    fireEvent.click(screen.getByRole("button", { name: "Rascunho" }));
    fireEvent.click(screen.getByRole("option", { name: "Publicado" }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("escolher a opção que já está ativa só fecha o menu; Esc e clique fora também fecham", () => {
    const { onUnpublish, onPublish } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Publicado" }));
    fireEvent.click(screen.getByRole("option", { name: "Publicado" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onUnpublish).not.toHaveBeenCalled();
    expect(onPublish).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Publicado" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Publicado" }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("sem permissão de escrita (ou status encerrado) a etiqueta é só texto", () => {
    const { unmount } = setup({ canWrite: false });
    expect(screen.queryByRole("button", { name: "Publicado" })).toBeNull();
    expect(screen.getByText("Publicado")).toBeInTheDocument();
    unmount();

    setup({ status: "finished", statusLabel: "Encerrada" });
    expect(screen.queryByRole("button", { name: "Encerrada" })).toBeNull();
    expect(screen.getByText("Encerrada")).toBeInTheDocument();
  });

  it("rascunho oferece Publicar e rebaixa Verificar publicações a secundário", () => {
    const { onPublish } = setup({ status: "draft", statusLabel: "Rascunho" });
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Verificar publicações" })).toHaveClass("out");
  });

  it("campanha publicada não oferece Publicar e Verificar publicações é a ação principal", () => {
    const { onCheckPublications } = setup();
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
    const verify = screen.getByRole("button", { name: "Verificar publicações" });
    expect(verify).not.toHaveClass("out");
    fireEvent.click(verify);
    expect(onCheckPublications).toHaveBeenCalledTimes(1);
  });

  it("somente leitura: só o convite à vista (em destaque) e Compartilhar no menu", () => {
    const { onOpenInvite, onShare } = setup({ canWrite: false });
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Verificar publicações" })).toBeNull();
    const invite = screen.getByRole("button", { name: "Ver convite" });
    expect(invite).toHaveClass("btn");
    fireEvent.click(invite);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Compartilhar" }));
    expect(onOpenInvite).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("verificando: troca o rótulo e desabilita o botão", () => {
    setup({ checking: true });
    expect(screen.getByRole("button", { name: "Verificando..." })).toBeDisabled();
  });
});
