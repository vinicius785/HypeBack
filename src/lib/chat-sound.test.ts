import { beforeEach, describe, expect, it, vi } from "vitest";

import { SOUND_MIN_GAP_MS, isChatSoundOn, playMessageSound, resetChatSoundForTests, setChatSoundOn } from "./chat-sound";

const osc = () => ({ type: "", frequency: { value: 0 }, connect: vi.fn(function (this: unknown) { return this; }), start: vi.fn(), stop: vi.fn() });
const gain = () => ({
  gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  connect: vi.fn(function (this: unknown) { return this; }),
});

function fakeAudio(state: "running" | "suspended" = "running") {
  const created: ReturnType<typeof osc>[] = [];
  class FakeCtx {
    state = state;
    currentTime = 0;
    destination = {};
    resume = vi.fn().mockResolvedValue(undefined);
    createOscillator() {
      const o = osc();
      created.push(o);
      return o;
    }
    createGain() {
      return gain();
    }
  }
  vi.stubGlobal("AudioContext", FakeCtx);
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
  return created;
}

describe("chat-sound", () => {
  beforeEach(() => {
    localStorage.clear();
    resetChatSoundForTests();
  });

  it("toca dois toques quando o som está ligado", () => {
    const notes = fakeAudio();
    expect(playMessageSound(10_000)).toBe(true);
    expect(notes).toHaveLength(2);
  });

  it("não toca desligado, nem repetido em menos de 1,5 s", () => {
    fakeAudio();
    setChatSoundOn(false);
    expect(isChatSoundOn()).toBe(false);
    expect(playMessageSound(10_000)).toBe(false);
    setChatSoundOn(true);
    expect(playMessageSound(20_000)).toBe(true);
    expect(playMessageSound(20_000 + SOUND_MIN_GAP_MS - 1)).toBe(false);
    expect(playMessageSound(20_000 + SOUND_MIN_GAP_MS)).toBe(true);
  });

  it("sem áudio liberado pelo navegador (suspenso) não toca e não quebra", () => {
    fakeAudio("suspended");
    expect(playMessageSound(10_000)).toBe(false);
  });
});
