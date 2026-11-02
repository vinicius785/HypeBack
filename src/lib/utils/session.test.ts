import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import { clearClientSession } from "./session";

beforeEach(() => localStorage.clear());

describe("clearClientSession", () => {
  it("apaga o token, o workspace escolhido e todo o cache (não só o do Admin)", () => {
    localStorage.setItem("token", "tok");
    localStorage.setItem("workspaceId", "ws-1");
    localStorage.setItem("outra-preferencia", "fica");
    const client = new QueryClient();
    client.setQueryData(["get-current-user"], { id: 1, is_platform_admin: true });
    client.setQueryData(["me-workspaces"], [{ id: "ws-1" }]);
    client.setQueryData(["admin", "platform", "users"], { data: [{ email: "x@y.com" }] });

    clearClientSession(client);

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("workspaceId")).toBeNull();
    expect(localStorage.getItem("outra-preferencia")).toBe("fica");
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getQueryData(["get-current-user"])).toBeUndefined();
  });
});
