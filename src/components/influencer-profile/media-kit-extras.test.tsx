import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PublicMediaKit } from "@/shared/services/influencer";

import { MediaKitContact, MediaKitIntro, MediaKitRates, formatPhone, whatsappLink } from "./media-kit-extras";

const kit = (over: Partial<PublicMediaKit> = {}): PublicMediaKit => ({ headline: null, intro: null, ...over });

describe("MediaKitIntro", () => {
  it("mostra a chamada e a apresentação, preservando quebras de linha", () => {
    render(<MediaKitIntro kit={kit({ headline: "Beleza real", intro: "Linha 1\nLinha 2" })} />);
    expect(screen.getByRole("heading", { name: "Beleza real" })).toBeInTheDocument();
    expect(screen.getByText(/Linha 1/)).toHaveClass("whitespace-pre-line");
  });
  it("sem texto não aparece", () => {
    const { container } = render(<MediaKitIntro kit={kit()} />);
    expect(container).toBeEmptyDOMElement();
    expect(render(<MediaKitIntro kit={null} />).container).toBeEmptyDOMElement();
  });
});

describe("MediaKitRates", () => {
  it("lista as tarifas por rede, em reais", () => {
    render(
      <MediaKitRates
        kit={kit({
          rates: [
            { network_id: 1, type: "instagram", items: [{ key: "feed", label: "Post", price_cents: 150000 }, { key: "reels", label: "Reels", price_cents: 200050 }] },
            { network_id: 2, type: "tiktok", items: [{ key: "video", label: "Vídeo", price_cents: 120000 }] },
          ],
        })}
      />,
    );
    const section = screen.getByRole("region", { name: "Tarifas" });
    expect(within(section).getByText("Instagram")).toBeInTheDocument();
    expect(within(section).getByText("TikTok")).toBeInTheDocument();
    expect(within(section).getByText(/1\.500,00/)).toBeInTheDocument();
    expect(within(section).getByText(/2\.000,50/)).toBeInTheDocument();
  });
  it("sem tarifas liberadas não mostra nada (nem o título)", () => {
    expect(render(<MediaKitRates kit={kit()} />).container).toBeEmptyDOMElement();
    expect(render(<MediaKitRates kit={kit({ rates: [] })} />).container).toBeEmptyDOMElement();
  });
});

describe("MediaKitContact", () => {
  it("e-mail e WhatsApp viram links", () => {
    render(<MediaKitContact kit={kit({ contact: { email: "comercial@ana.com", phone: "11999990000" } })} />);
    expect(screen.getByRole("link", { name: /comercial@ana.com/ })).toHaveAttribute("href", "mailto:comercial@ana.com");
    const wa = screen.getByRole("link", { name: /WhatsApp \(11\) 99999-0000/ });
    expect(wa).toHaveAttribute("href", "https://wa.me/5511999990000");
    expect(wa).toHaveAttribute("rel", "noopener noreferrer");
  });
  it("só um canal: mostra só ele", () => {
    render(<MediaKitContact kit={kit({ contact: { email: "a@b.com", phone: null } })} />);
    expect(screen.getByRole("link", { name: /a@b.com/ })).toBeInTheDocument();
    expect(screen.queryByText(/WhatsApp/)).not.toBeInTheDocument();
  });
  it("sem contato liberado não aparece", () => {
    expect(render(<MediaKitContact kit={kit()} />).container).toBeEmptyDOMElement();
    expect(render(<MediaKitContact kit={kit({ contact: { email: null, phone: null } })} />).container).toBeEmptyDOMElement();
  });
});

describe("telefone", () => {
  it("whatsappLink põe o 55 quando falta e não duplica", () => {
    expect(whatsappLink("(11) 99999-0000")).toBe("https://wa.me/5511999990000");
    expect(whatsappLink("5511999990000")).toBe("https://wa.me/5511999990000");
  });
  it("formatPhone: celular, fixo, com 55 e formato desconhecido", () => {
    expect(formatPhone("11999990000")).toBe("(11) 99999-0000");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
    expect(formatPhone("5511999990000")).toBe("(11) 99999-0000");
    expect(formatPhone("+1 202 555 0101")).toBe("+1 202 555 0101");
  });
});
