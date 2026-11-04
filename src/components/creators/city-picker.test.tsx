import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CityPicker } from "./city-picker";

const searchCities = vi.fn();
vi.mock("@/lib/city-search", () => ({ searchCities: (...a: unknown[]) => searchCities(...a) }));

const rp = { label: "Ribeirão Preto, São Paulo", name: "Ribeirão Preto", state: "São Paulo", lat: -21.17, lng: -47.81, radiusKm: 25 };

describe("CityPicker", () => {
  afterEach(() => searchCities.mockReset());

  it("busca depois de 3 letras e devolve a cidade escolhida", async () => {
    searchCities.mockResolvedValue([rp]);
    const onPick = vi.fn();
    render(<CityPicker onPick={onPick} />);
    const input = screen.getByPlaceholderText(/Buscar cidade/);
    fireEvent.change(input, { target: { value: "Ri" } });
    expect(searchCities).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Ribeirão" } });
    fireEvent.click(await screen.findByRole("button", { name: /Ribeirão Preto, São Paulo/ }));
    expect(onPick).toHaveBeenCalledWith(rp);
  });

  it("avisa quando não acha ou quando a busca falha", async () => {
    searchCities.mockResolvedValueOnce([]);
    render(<CityPicker onPick={() => {}} />);
    const input = screen.getByPlaceholderText(/Buscar cidade/);
    fireEvent.change(input, { target: { value: "Xyzzy" } });
    await waitFor(() => expect(screen.getByText("Nenhuma cidade encontrada.")).toBeTruthy());
    searchCities.mockRejectedValueOnce(new Error("x"));
    fireEvent.change(input, { target: { value: "Xyzzyw" } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Não foi possível buscar/));
  });
});
