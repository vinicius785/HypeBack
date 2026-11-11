/**
 * Confiança da conta (nível 1 a 5): selo, dica de motivos e bloco do detalhe.
 *
 * O QUE PRECISA FUNCIONAR: cada nível com o seu número, cor e texto alternativo; "—" sem `trust`; dica com sinal e pontos
 * (também por teclado), no máximo 6 motivos e "+N"; o detalhe com nota, a lista completa e o aviso de estimativa.
 * O QUE NÃO PODE ACONTECER: só a cor dizer o nível; o nível decidir algo sozinho (nada de suspender); e-mail completo na dica.
 */
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TRUST_DISCLAIMER, formatTrustPoints, splitTrustReasons, trustAriaLabel, usableTrust } from "@/lib/admin/trust";
import type { AdminUserTrust, AdminUserTrustLevel, AdminUserTrustReason } from "@/shared/admin-platform.types";

import { AdminUserTrustSection, TrustBadge } from "./admin-user-trust";

const reason = (code: string, label: string, points: number): AdminUserTrustReason => ({ code, label, points, effect: points >= 0 ? "positive" : "negative" });
const trust = (level: AdminUserTrustLevel, over: Partial<AdminUserTrust> = {}): AdminUserTrust => ({
  level,
  score: level * 20 - 10,
  reasons: [reason("blocked_domain", "Domínio de e-mail usado em ataque", -45), reason("email_verified", "E-mail verificado", 15)],
  ...over,
});

const MANY = Array.from({ length: 8 }, (_, i) => reason(`r${i}`, `Motivo número ${i + 1}`, i % 2 === 0 ? 20 - i : -(20 - i)));

describe("regras de exibição", () => {
  it("sinal e pontos: '+15', '−45' (sinal de menos de verdade) e '0'", () => {
    expect(formatTrustPoints(15)).toBe("+15");
    expect(formatTrustPoints(-45)).toBe("−45");
    expect(formatTrustPoints(0)).toBe("0");
  });

  it("texto alternativo de cada nível", () => {
    expect([1, 2, 3, 4, 5].map((l) => trustAriaLabel(l as AdminUserTrustLevel))).toEqual([
      "Confiança 1 de 5: muito provável bot",
      "Confiança 2 de 5: suspeito",
      "Confiança 3 de 5: incerto",
      "Confiança 4 de 5: provável pessoa real",
      "Confiança 5 de 5: perfil real",
    ]);
  });

  it("separa os 6 primeiros motivos e conta o resto", () => {
    expect(splitTrustReasons(MANY)).toEqual({ shown: MANY.slice(0, 6), hidden: 2 });
    expect(splitTrustReasons(MANY.slice(0, 6))).toEqual({ shown: MANY.slice(0, 6), hidden: 0 });
  });

  it("nível fora de 1 a 5 (ou ausente) não é utilizável", () => {
    expect(usableTrust(null)).toBeNull();
    expect(usableTrust(undefined)).toBeNull();
    expect(usableTrust({ ...trust(3), level: 9 as AdminUserTrustLevel })).toBeNull();
    expect(usableTrust({ ...trust(3), level: 0 as AdminUserTrustLevel })).toBeNull();
  });

});

describe("selo na lista", () => {
  it.each([1, 2, 3, 4, 5] as AdminUserTrustLevel[])("nível %s: o número aparece, com a cor do nível e o texto alternativo", (level) => {
    render(<TrustBadge trust={trust(level)} />);
    const badge = screen.getByRole("button", { name: trustAriaLabel(level) });
    expect(badge).toHaveTextContent(String(level));
    expect(badge).toHaveAttribute("data-level", String(level));
  });

  it("sem trust (null ou ausente) mostra '—' e nenhum selo", () => {
    const { rerender } = render(<TrustBadge trust={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<TrustBadge trust={undefined} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("a dica lista os motivos com sinal e pontos e abre ao focar por teclado", async () => {
    const user = userEvent.setup();
    render(<TrustBadge trust={trust(1, { score: 12 })} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.tab();
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Nota 12/100 · muito provável bot");
    expect(tip).toHaveTextContent("−45Domínio de e-mail usado em ataque");
    expect(tip).toHaveTextContent("+15E-mail verificado");
    expect(screen.getByRole("button", { name: "Confiança 1 de 5: muito provável bot" })).toHaveAccessibleDescription(/Domínio de e-mail usado em ataque/);
  });

  it("a dica também abre ao passar o mouse", async () => {
    const user = userEvent.setup();
    render(<TrustBadge trust={trust(5)} />);
    await user.hover(screen.getByRole("button", { name: "Confiança 5 de 5: perfil real" }));
    expect(await screen.findByRole("tooltip", {}, { timeout: 2000 })).toHaveTextContent("E-mail verificado");
  });

  it("com mais de 6 motivos mostra só 6 e o '+N' do resto", async () => {
    const user = userEvent.setup();
    render(<TrustBadge trust={trust(3, { reasons: MANY })} />);
    await user.tab();
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Motivo número 6");
    expect(tip).not.toHaveTextContent("Motivo número 7");
    expect(tip).toHaveTextContent("+2 no detalhe da conta");
  });

  it("Escape fecha a dica", async () => {
    const user = userEvent.setup();
    render(<TrustBadge trust={trust(2)} />);
    await user.tab();
    await screen.findByRole("tooltip");
    await act(async () => {
      await user.keyboard("{Escape}");
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("não há ação nenhuma no selo (nada de suspender por causa do nível)", () => {
    render(<TrustBadge trust={trust(1)} />);
    expect(screen.queryByRole("button", { name: /suspender|bloquear/i })).not.toBeInTheDocument();
  });
});

describe("bloco do detalhe", () => {
  it("mostra selo, nota, o aviso de estimativa e a lista COMPLETA de motivos (positivos e negativos)", () => {
    render(<AdminUserTrustSection trust={trust(2, { score: 33, reasons: MANY })} />);
    const section = screen.getByRole("region", { name: "Confiança da conta" });
    expect(within(section).getByRole("img", { name: "Confiança 2 de 5: suspeito" })).toHaveTextContent("2");
    expect(within(section).getByText("suspeito")).toBeInTheDocument();
    expect(section).toHaveTextContent("Nota 33/100");
    expect(section).toHaveTextContent("Estimativa automática por sinais. Serve para priorizar a análise e não suspende a conta.");
    expect(TRUST_DISCLAIMER).toBe("Estimativa automática por sinais. Serve para priorizar a análise e não suspende a conta.");
    const list = within(section).getByRole("list", { name: "Motivos do nível de confiança" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    expect(list.querySelectorAll('[data-effect="positive"]').length).toBe(4);
    expect(list.querySelectorAll('[data-effect="negative"]').length).toBe(4);
    expect(within(list).getAllByText(/^[+−]\d+$/)).toHaveLength(8);
  });

  it("sem trust: '—' e a explicação, sem selo", () => {
    render(<AdminUserTrustSection trust={null} />);
    const section = screen.getByRole("region", { name: "Confiança da conta" });
    expect(section).toHaveTextContent("—");
    expect(section).toHaveTextContent("Sem cálculo para esta conta");
    expect(within(section).queryByRole("img")).not.toBeInTheDocument();
  });

  it("conta sem nenhum motivo diz isso", () => {
    render(<AdminUserTrustSection trust={trust(3, { reasons: [] })} />);
    expect(screen.getByText("Nenhum sinal registrado para esta conta.")).toBeInTheDocument();
  });
});
