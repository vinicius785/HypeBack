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
      creators={0}
      progress={50}
      canWrite
      checking={false}
      {...handlers}
      {...props}
    >
      <nav data-testid="tabs" />
    </CampaignHeader>,
  );
  return { ...view, ...handlers };
}

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

  it("publicada: a etiqueta despublica para quem pode escrever e é só texto para quem não pode", () => {
    const { onUnpublish, unmount } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Publicado" }));
    expect(onUnpublish).toHaveBeenCalledTimes(1);
    unmount();

    setup({ canWrite: false });
    expect(screen.queryByRole("button", { name: "Publicado" })).toBeNull();
    expect(screen.getByText("Publicado")).toBeInTheDocument();
  });

  it("rascunho oferece Publicar e rebaixa Verificar publicações a secundário", () => {
    const { onPublish } = setup({ status: "draft", statusLabel: "Rascunho" });
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Verificar publicações" })).toHaveClass("out");
  });

  it("campanha publicada não oferece Publicar e Verificar publicações é a ação principal", () => {
    const { onCheckPublications, onEdit } = setup();
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
    const verify = screen.getByRole("button", { name: "Verificar publicações" });
    expect(verify).not.toHaveClass("out");
    fireEvent.click(verify);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(onCheckPublications).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("somente leitura: só convite e compartilhar, com o convite em destaque", () => {
    const { onOpenInvite, onShare } = setup({ canWrite: false });
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Verificar publicações" })).toBeNull();
    const invite = screen.getByRole("button", { name: "Ver convite" });
    expect(invite).toHaveClass("btn");
    fireEvent.click(invite);
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    expect(onOpenInvite).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("verificando: troca o rótulo e desabilita o botão", () => {
    setup({ checking: true });
    expect(screen.getByRole("button", { name: "Verificando..." })).toBeDisabled();
  });

  it("concorda o plural de criadores e limita o progresso entre 0 e 100", () => {
    const { unmount } = setup({ creators: 1, progress: 140 });
    expect(screen.getByText("criador")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    unmount();

    setup({ creators: 12, progress: -5 });
    expect(screen.getByText("criadores")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
