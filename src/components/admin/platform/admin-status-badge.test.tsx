import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NOTIFICATION_STATUS_LABEL, NOTIFICATION_STATUS_TONE } from "@/lib/admin/labels";

import { AdminStatusBadge } from "./admin-status-badge";

describe("AdminStatusBadge kind='notification'", () => {
  it.each([
    ["draft", "Rascunho", "muted"],
    ["scheduled", "Agendada", "warn"],
    ["sending", "Enviando", "warn"],
    ["sent", "Enviada", "ok"],
    ["partially_failed", "Entrega parcial", "warn"],
    ["failed", "Falhou", "bad"],
    ["cancelled", "Cancelada", "muted"],
  ] as const)("%s → '%s' (%s)", (value, label, tone) => {
    render(<AdminStatusBadge kind="notification" value={value} />);
    const badge = screen.getByText(label);
    expect(badge).toHaveClass("adm-badge");
    expect(badge).toHaveAttribute("data-tone", tone);
  });

  it("usa os mapas de labels.ts (uma fonte só) e cobre os 7 status", () => {
    expect(Object.keys(NOTIFICATION_STATUS_LABEL).sort()).toEqual(Object.keys(NOTIFICATION_STATUS_TONE).sort());
    expect(Object.keys(NOTIFICATION_STATUS_LABEL)).toHaveLength(7);
  });

  it("status novo do backend não quebra: texto cru em cinza; label e size podem ser trocados", () => {
    const { rerender } = render(<AdminStatusBadge kind="notification" value={"paused" as never} />);
    expect(screen.getByText("paused")).toHaveAttribute("data-tone", "muted");
    rerender(<AdminStatusBadge kind="notification" value="sent" label="Entregue" size="sm" />);
    expect(screen.getByText("Entregue")).toHaveAttribute("data-size", "sm");
  });
});
