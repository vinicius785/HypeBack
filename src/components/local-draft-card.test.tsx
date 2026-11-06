import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderAdminRoute, stubRoute } from "@/test/render-admin-route";

import { LocalDraftCard } from "./local-draft-card";

afterEach(() => cleanup());

describe("LocalDraftCard", () => {
  it("cada rascunho retoma o SEU formulário: o link leva o id na URL (assim dá para ter vários)", async () => {
    renderAdminRoute(
      [
        {
          path: "/campaigns",
          component: () => (
            <LocalDraftCard draft={{ id: "d-abc", title: "Verão", savedAt: null, workspaceId: null }} onDiscard={() => {}} />
          ),
        },
        { ...stubRoute("/campaigns/new"), validateSearch: (raw) => ({ draft: raw.draft }) },
      ],
      "/campaigns",
    );
    const links = await screen.findAllByRole("link", { name: /Verão|Continuar editando/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute("href")).toBe("/campaigns/new?draft=d-abc");
  });
});
