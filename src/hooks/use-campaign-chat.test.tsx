import { describe, expect, it } from "vitest";

import { RateLimitError } from "@/shared/services/chat";
import { CHAT_POLL_MS } from "./use-campaign-chat";

describe("chat da campanha: frequência", () => {
  it("consulta a cada 30 s (antes 10 s)", () => {
    expect(CHAT_POLL_MS).toBe(30_000);
  });
  it("RateLimitError carrega o tempo de espera", () => {
    expect(new RateLimitError(60_000).retryAfterMs).toBe(60_000);
  });
});
