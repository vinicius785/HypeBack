import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { CampaignFormData } from "@/shared/types";

import { useSyncBrandRequired } from "./use-brand-required";

const useForm = (isAgency: boolean) => {
  const [data, setData] = useState({ brandRequired: false, title: "x" } as CampaignFormData);
  useSyncBrandRequired(isAgency, setData);
  return data;
};

describe("useSyncBrandRequired", () => {
  it("o workspace que carrega DEPOIS da primeira renderização liga o campo Marca", () => {
    const { result, rerender } = renderHook(({ agency }) => useForm(agency), { initialProps: { agency: false } });
    expect(result.current.brandRequired).toBe(false);
    act(() => rerender({ agency: true }));
    expect(result.current.brandRequired).toBe(true);
    expect(result.current.title).toBe("x"); // o resto do formulário fica como estava
  });

  it("trocar para um workspace de marca desliga o campo", () => {
    const { result, rerender } = renderHook(({ agency }) => useForm(agency), { initialProps: { agency: true } });
    expect(result.current.brandRequired).toBe(true);
    act(() => rerender({ agency: false }));
    expect(result.current.brandRequired).toBe(false);
  });
});
