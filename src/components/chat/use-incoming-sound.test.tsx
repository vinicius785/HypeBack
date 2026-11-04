import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const play = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat-sound", () => ({ playMessageSound: play }));

import { useIncomingSound } from "./use-incoming-sound";

describe("useIncomingSound", () => {
  beforeEach(() => play.mockClear());

  it("o histórico que carrega ao abrir não toca; mensagem nova de outra pessoa toca", () => {
    const { rerender } = renderHook(({ k, ready }) => useIncomingSound(k, ready), { initialProps: { k: null as string | null, ready: false } });
    rerender({ k: "m1", ready: true });
    expect(play).not.toHaveBeenCalled();
    rerender({ k: "m2", ready: true });
    expect(play).toHaveBeenCalledTimes(1);
    rerender({ k: "m2", ready: true });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("conversa que abre sem mensagens recebidas toca na primeira que chegar", () => {
    const { rerender } = renderHook(({ k }) => useIncomingSound(k, true), { initialProps: { k: null as string | null } });
    rerender({ k: "m1" });
    expect(play).toHaveBeenCalledTimes(1);
  });
});
