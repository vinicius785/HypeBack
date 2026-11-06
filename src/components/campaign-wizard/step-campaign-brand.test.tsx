import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StepCampaign } from "./step-campaign";

const q = vi.hoisted(() => ({
  state: { data: undefined as unknown, isSuccess: false, isError: false, isLoading: false },
}));
vi.mock("@/hooks/use-agency-brands", () => ({ useAgencyBrands: () => q.state }));

afterEach(() => {
  cleanup();
  q.state = { data: undefined, isSuccess: false, isError: false, isLoading: false };
});

const brand = (id: string, name: string) => ({ id, name, status: "active" });

const setup = (brandId = "") => {
  const updateFormData = vi.fn();
  render(
    <StepCampaign
      formData={{ banner: "", brandRequired: true, brandId, title: "", description: "" } as never}
      updateFormData={updateFormData}
      fieldErrors={new Set()}
      tried={false}
    />,
  );
  return updateFormData;
};

describe("Campanha de agência — campo Marca", () => {
  it("lista ainda não carregada (consulta desligada): não apaga a marca escolhida nem diz que não há marcas", () => {
    // workspace ainda carregando: a consulta fica desligada (nem sucesso, nem erro) e a lista vem vazia
    const update = setup("b-1");
    expect(update).not.toHaveBeenCalledWith("brandId", "");
    expect(screen.queryByText(/Crie uma marca/)).not.toBeInTheDocument();
    expect(screen.getByText("Marca")).toBeInTheDocument();
  });

  it("erro ao carregar as marcas também não apaga a escolha", () => {
    q.state = { data: undefined, isSuccess: false, isError: true, isLoading: false };
    const update = setup("b-1");
    expect(update).not.toHaveBeenCalledWith("brandId", "");
  });

  it("lista carregada sem a marca do rascunho (outro workspace): limpa a escolha", () => {
    q.state = { data: [brand("b-2", "Beta")], isSuccess: true, isError: false, isLoading: false };
    const update = setup("b-1");
    expect(update).toHaveBeenCalledWith("brandId", "");
  });

  it("lista carregada com uma só marca ativa: já escolhe", () => {
    q.state = { data: [brand("b-2", "Beta")], isSuccess: true, isError: false, isLoading: false };
    const update = setup("");
    expect(update).toHaveBeenCalledWith("brandId", "b-2");
  });

  it("lista carregada e vazia: orienta a criar uma marca", () => {
    q.state = { data: [], isSuccess: true, isError: false, isLoading: false };
    setup("");
    expect(screen.getByText(/Crie uma marca/)).toBeInTheDocument();
  });
});
