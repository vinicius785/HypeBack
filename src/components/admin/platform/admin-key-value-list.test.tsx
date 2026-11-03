import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminKeyValueList } from "./admin-key-value-list";

const ITEMS = [
  { label: "Banco", value: "OK" },
  { label: "Cache", value: "Desligado", hint: "Redis" },
  { label: "Snapshot", value: null },
];

describe("AdminKeyValueList: layout", () => {
  it("padrão é a lista de antes (sem data-layout)", () => {
    const { container } = render(<AdminKeyValueList items={ITEMS} />);
    const dl = container.querySelector("dl") as HTMLElement;
    expect(dl).not.toHaveAttribute("data-layout");
    expect(dl).not.toHaveAttribute("data-columns");
  });

  it("columns=2 continua valendo em list", () => {
    const { container } = render(<AdminKeyValueList items={ITEMS} columns={2} />);
    expect(container.querySelector("dl")).toHaveAttribute("data-columns", "2");
  });

  it("strip marca o layout, ignora columns e mantém a semântica dl/dt/dd com os mesmos valores", () => {
    const { container } = render(<AdminKeyValueList items={ITEMS} layout="strip" columns={2} />);
    const dl = container.querySelector("dl") as HTMLElement;
    expect(dl).toHaveAttribute("data-layout", "strip");
    expect(dl).not.toHaveAttribute("data-columns");
    expect(container.querySelectorAll("dt")).toHaveLength(3);
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(container.querySelectorAll("dd")[2]).toHaveTextContent("—");
  });
});
