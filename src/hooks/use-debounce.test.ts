import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "./use-debounce";

describe("useDebounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retorna o valor inicial imediatamente", () => {
    const { result } = renderHook(() => useDebounce("inicial", 400));
    expect(result.current).toBe("inicial");
  });

  it("não atualiza antes do delay", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 400), {
      initialProps: { v: "a" },
    });

    rerender({ v: "b" });
    act(() => vi.advanceTimersByTime(200));

    expect(result.current).toBe("a"); // ainda não atualizou
  });

  it("atualiza após o delay", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 400), {
      initialProps: { v: "a" },
    });

    rerender({ v: "b" });
    act(() => vi.advanceTimersByTime(400));

    expect(result.current).toBe("b");
  });

  it("reinicia o timer a cada mudança de valor", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 400), {
      initialProps: { v: "a" },
    });

    rerender({ v: "b" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ v: "c" });
    act(() => vi.advanceTimersByTime(200));

    expect(result.current).toBe("a"); // ainda não chegou a 400ms desde "c"

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("c");
  });
});
