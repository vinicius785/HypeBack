/**
 * O @ do criador nas campanhas: abre a rede dele.
 *
 * O QUE PRECISA FUNCIONAR:
 *   - com a rede conhecida (Instagram, TikTok, YouTube, X, Facebook) o @ é um link para o perfil, em outra aba, sem mandar a página de origem;
 *   - o arroba digitado no começo não duplica; sem rede conhecida ou sem @, não há link;
 *   - dentro de um cartão clicável o clique no @ não aciona o cartão.
 *
 * O QUE NÃO PODE ACONTECER:
 *   - montar um endereço torto a partir de um @ com barra, interrogação, espaço ou outro caractere que @ de rede não tem.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { cleanHandle, SocialHandle, socialHandleUrl } from "./social-handle";

describe("socialHandleUrl", () => {
  it("monta o endereço do perfil de cada rede", () => {
    expect(socialHandleUrl("instagram", "bia.santos")).toBe("https://instagram.com/bia.santos");
    expect(socialHandleUrl("tiktok", "bia_santos")).toBe("https://tiktok.com/@bia_santos");
    expect(socialHandleUrl("youtube", "bia-santos")).toBe("https://youtube.com/@bia-santos");
    expect(socialHandleUrl("twitter", "bia")).toBe("https://twitter.com/bia");
    expect(socialHandleUrl("facebook", "bia")).toBe("https://facebook.com/bia");
  });

  it("tira o arroba e os espaços; rede desconhecida ou @ vazio não têm endereço", () => {
    expect(cleanHandle("  @bia ")).toBe("bia");
    expect(socialHandleUrl("instagram", "@bia")).toBe("https://instagram.com/bia");
    expect(socialHandleUrl("ugc", "bia")).toBeUndefined();
    expect(socialHandleUrl(undefined, "bia")).toBeUndefined();
    expect(socialHandleUrl("instagram", "")).toBeUndefined();
    expect(socialHandleUrl("instagram", null)).toBeUndefined();
  });

  it("não monta endereço com @ que tem barra, interrogação, espaço ou outro caractere estranho", () => {
    for (const bad of ["bia/../evil", "bia?x=1", "bia santos", "bia#top", "https://evil.com", "bia\\x"]) {
      expect(socialHandleUrl("instagram", bad)).toBeUndefined();
    }
  });
});

describe("SocialHandle", () => {
  it("com a rede conhecida é um link que abre o perfil em outra aba, sem referrer", () => {
    render(<SocialHandle username="bia.santos" network="instagram" />);
    const link = screen.getByRole("link", { name: "@bia.santos" });
    expect(link).toHaveAttribute("href", "https://instagram.com/bia.santos");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("title", "Abrir Instagram de @bia.santos");
  });

  it("não duplica o arroba que já vem no @", () => {
    render(<SocialHandle username="@bia" network="tiktok" />);
    expect(screen.getByRole("link", { name: "@bia" })).toHaveAttribute("href", "https://tiktok.com/@bia");
  });

  it("sem rede conhecida, ou com @ estranho, continua só texto (sem link)", () => {
    const { rerender } = render(<SocialHandle username="bia" network={undefined} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("@bia")).toBeInTheDocument();
    rerender(<SocialHandle username="bia/../x" network="instagram" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("@bia/../x")).toBeInTheDocument();
  });

  it("sem @ não mostra nada", () => {
    const { container } = render(<SocialHandle username="" network="instagram" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dentro de um cartão clicável o clique no @ não aciona o cartão", () => {
    const onCard = vi.fn();
    render(
      <article onClick={onCard} onPointerDown={onCard} onKeyDown={onCard}>
        <SocialHandle username="bia" network="instagram" />
        <span>resto do cartão</span>
      </article>,
    );
    const link = screen.getByRole("link", { name: "@bia" });
    fireEvent.pointerDown(link);
    fireEvent.keyDown(link, { key: "Enter" });
    fireEvent.click(link);
    expect(onCard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("resto do cartão"));
    expect(onCard).toHaveBeenCalledTimes(1);
  });

  it("texto de exibição próprio (children) mantém o link", () => {
    render(
      <SocialHandle username="bia" network="youtube">
        Ver canal
      </SocialHandle>,
    );
    expect(screen.getByRole("link", { name: "Ver canal" })).toHaveAttribute("href", "https://youtube.com/@bia");
  });
});
