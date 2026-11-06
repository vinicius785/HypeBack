import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CAMPAIGN_BANNER_TYPE_ERROR } from "@/lib/campaign-banner";

import { StepCampaign } from "./step-campaign";

vi.mock("@/hooks/use-agency-brands", () => ({ useAgencyBrands: () => ({ data: [], isLoading: false }) }));

afterEach(cleanup);

const setup = (banner = "") => {
  const updateFormData = vi.fn();
  const utils = render(
    <StepCampaign
      formData={{ banner, brandRequired: false, title: "", description: "" } as never}
      updateFormData={updateFormData}
      fieldErrors={new Set()}
      tried={false}
    />,
  );
  const zone = utils.container.querySelector("#wz-banner") as HTMLElement;
  return { zone, updateFormData };
};

const filesTransfer = (files: File[]) => ({ types: ["Files"], files, dropEffect: "none" });

describe("Banner da campanha — arrastar e soltar", () => {
  it("arrastar um arquivo por cima destaca a área; sair dela volta ao normal", () => {
    const { zone } = setup();
    expect(screen.getByText("Enviar banner")).toBeInTheDocument();
    expect(screen.getByText(/Clique ou arraste uma imagem/)).toBeInTheDocument();

    fireEvent.dragEnter(zone, { dataTransfer: filesTransfer([]) });
    expect(screen.getByText("Solte a imagem aqui")).toBeInTheDocument();
    expect(zone.className).toMatch(/\bdrag\b/);

    fireEvent.dragLeave(zone, { relatedTarget: document.body });
    expect(screen.getByText("Enviar banner")).toBeInTheDocument();
  });

  it("o dragover aceita o arquivo (preventDefault), senão o navegador não dispara o drop", () => {
    const { zone } = setup();
    const ev = createEvent.dragOver(zone, { dataTransfer: filesTransfer([]) });
    fireEvent(zone, ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("arrastar texto ou link (não é arquivo) é ignorado", () => {
    const { zone } = setup();
    const ev = createEvent.dragOver(zone, { dataTransfer: { types: ["text/plain"], files: [] } });
    fireEvent(zone, ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(screen.queryByText("Solte a imagem aqui")).not.toBeInTheDocument();
  });

  it("soltar um arquivo que não é JPG nem PNG mostra o aviso e não troca o banner", () => {
    const { zone, updateFormData } = setup();
    const txt = new File(["oi"], "nota.txt", { type: "text/plain" });
    fireEvent.drop(zone, { dataTransfer: filesTransfer([txt]) });
    expect(screen.getByText(CAMPAIGN_BANNER_TYPE_ERROR)).toBeInTheDocument();
    expect(updateFormData).not.toHaveBeenCalledWith("banner", expect.anything());
    // a área volta ao normal depois do drop
    expect(screen.getByText("Enviar banner")).toBeInTheDocument();
  });

  it("com banner já enviado, arrastar por cima oferece trocar", () => {
    const { zone } = setup("data:image/png;base64,AAAA");
    expect(screen.getByAltText("Banner da campanha")).toBeInTheDocument();
    fireEvent.dragEnter(zone, { dataTransfer: filesTransfer([]) });
    expect(screen.getByText("Solte para trocar o banner")).toBeInTheDocument();
    fireEvent.dragLeave(zone, { relatedTarget: null });
    expect(screen.queryByText("Solte para trocar o banner")).not.toBeInTheDocument();
  });

  it("passar o ponteiro por um filho da área não apaga o destaque", () => {
    const { zone } = setup();
    fireEvent.dragEnter(zone, { dataTransfer: filesTransfer([]) });
    const child = zone.querySelector("b") as HTMLElement;
    // O jsdom não tem DragEvent: o `relatedTarget` entra por fora no evento.
    const leave = createEvent.dragLeave(zone);
    Object.defineProperty(leave, "relatedTarget", { value: child });
    fireEvent(zone, leave);
    expect(screen.getByText("Solte a imagem aqui")).toBeInTheDocument();
  });
});
