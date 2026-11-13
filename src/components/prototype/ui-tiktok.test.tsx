import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I } from "./ui";

describe("ícone do TikTok", () => {
  it("é a marca original (preenchida), não a nota musical do Lucide", () => {
    const { container } = render(<I n="tiktok" cls="sm" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toContain("ico");
    expect(svg.style.fill).toBe("currentColor");
    expect(svg.querySelector("path")).toBeTruthy();
    expect(svg.getAttribute("class")).not.toContain("lucide");
  });
  it("os demais ícones seguem o Lucide", () => {
    const { container } = render(<I n="instagram" />);
    expect(container.querySelector("svg")!.getAttribute("class")).toContain("lucide");
  });
});
