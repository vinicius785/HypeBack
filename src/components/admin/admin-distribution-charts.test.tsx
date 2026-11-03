/** Gráficos de nicho e de tamanho (perfil da base de criadores): os estados vêm do kit. */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminNicheChart } from "./admin-niche-chart";
import { AdminSizeChart } from "./admin-size-chart";

describe.each([
  ["nicho", (props: Record<string, unknown>) => <AdminNicheChart data={undefined} {...props} />, "Carregando nichos…"],
  ["tamanho", (props: Record<string, unknown>) => <AdminSizeChart data={undefined} {...props} />, "Carregando tamanhos…"],
])("gráfico de %s", (_name, renderChart, loadingText) => {
  it("carregando: esqueleto anunciado (não um 'Carregando…' solto)", () => {
    render(renderChart({ isLoading: true }));

    expect(screen.getByRole("status")).toHaveTextContent(loadingText);
  });

  it("erro: estado de erro do kit; 'Tentar de novo' só aparece quando quem usa passa onRetry", async () => {
    const { unmount } = render(renderChart({ isError: true }));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar");
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
    unmount();

    const onRetry = vi.fn();
    render(renderChart({ isError: true, onRetry }));
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("sem dado: 'Sem dados ainda'", () => {
    render(renderChart({}));

    expect(screen.getByText("Sem dados ainda")).toBeInTheDocument();
  });
});

describe("com dados", () => {
  it("nicho: uma linha por nicho com a porcentagem", () => {
    render(<AdminNicheChart data={[{ niche_id: 1, niche_name: "Moda", percentage: 40.5 } as never]} />);

    expect(screen.getByText("Moda")).toBeInTheDocument();
    expect(screen.getByText("40,5%")).toBeInTheDocument();
  });

  it("tamanho: legenda com o total e as faixas; o desenho do donut é decorativo", () => {
    const { container } = render(
      <AdminSizeChart data={[{ bucket: "micro", count: 30, percentage: 100 } as never]} />,
    );

    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Micro")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
