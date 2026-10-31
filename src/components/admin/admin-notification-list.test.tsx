import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminNotificationListItem } from "@/shared/types";

import { AdminNotificationList, inAppSummary } from "./admin-notification-list";

vi.mock("@/hooks/use-admin-notifications", () => ({
  useCancelAdminNotification: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-niches", () => ({ useNiches: () => ({ data: [] }) }));

function item(
  id: string,
  channels: AdminNotificationListItem["channels"],
  stats: AdminNotificationListItem["stats"],
): AdminNotificationListItem {
  return {
    id,
    title: `Aviso ${id}`,
    body: "Texto do aviso",
    cta_url: null,
    channels,
    audience: { type: "all" },
    status: "sent",
    scheduled_at: null,
    sent_at: "2026-10-31T15:00:00Z",
    created_at: "2026-10-31T14:59:00Z",
    created_by: { id: 1, name: "Admin" },
    stats,
  };
}

describe("inAppSummary", () => {
  it("mostra quantos leram e a porcentagem sobre os itens criados no sino", () => {
    expect(inAppSummary({ total_recipients: 120, delivered: 118, failed: 2, in_app: { total: 118, read: 43 } })).toBe(
      "43 leram no app (36%)",
    );
  });

  it("concorda no singular e arredonda", () => {
    expect(inAppSummary({ total_recipients: 3, delivered: 3, failed: 0, in_app: { total: 3, read: 1 } })).toBe(
      "1 leu no app (33%)",
    );
  });

  it("com 0 leituras ainda informa (ninguém abriu ainda é informação)", () => {
    expect(inAppSummary({ total_recipients: 10, delivered: 10, failed: 0, in_app: { total: 10, read: 0 } })).toBe(
      "0 leram no app (0%)",
    );
  });

  it("some quando não há itens no sino: sem push, sem dado ou antes do recurso existir", () => {
    expect(inAppSummary(undefined)).toBe("");
    expect(inAppSummary({ total_recipients: 5, delivered: 5, failed: 0 })).toBe("");
    expect(inAppSummary({ total_recipients: 5, delivered: 5, failed: 0, in_app: { total: 0, read: 0 } })).toBe("");
  });
});

describe("AdminNotificationList · leram no app", () => {
  it("mostra a leitura só nos disparos que geraram itens no sino", () => {
    render(
      <AdminNotificationList
        items={[
          item("a", ["push", "email"], { total_recipients: 120, delivered: 118, failed: 2, in_app: { total: 118, read: 43 } }),
          item("b", ["email"], { total_recipients: 40, delivered: 40, failed: 0 }),
        ]}
        isLoading={false}
        isError={false}
        onRetry={() => {}}
        onNew={() => {}}
        onDuplicate={() => {}}
      />,
    );

    expect(screen.getByText("43 leram no app (36%)")).toBeInTheDocument();
    expect(screen.getByText("118 de 120 entregues")).toBeInTheDocument(); // o resumo de entrega continua
    expect(screen.getByText("40 de 40 entregues")).toBeInTheDocument();
    expect(screen.getAllByText(/no app \(/)).toHaveLength(1);
  });
});
