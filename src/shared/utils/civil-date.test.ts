import { describe, expect, it } from "vitest";

import { formatCivilDatePtBr } from "./civil-date";

describe("formatCivilDatePtBr", () => {
  it("preserves the configured campaign day", () => {
    expect(formatCivilDatePtBr("2026-08-10")).toBe("10/08/2026");
  });

  it("rejects invalid days", () => {
    expect(formatCivilDatePtBr("2026-02-30")).toBeNull();
  });
});
