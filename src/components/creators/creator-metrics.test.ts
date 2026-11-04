import { describe, expect, it } from "vitest";

import { engagementLabel, fmtDistance, fmtFollowers, followersLabel, splitCategories } from "./creator-metrics";

describe("fmtFollowers", () => {
  it.each([
    [0, "0"],
    [268, "268"],
    [999, "999"],
    [1_000, "1 mil"],
    [1_250, "1,3 mil"],
    [22_000, "22 mil"],
    [99_949, "99,9 mil"],
    [150_400, "150 mil"],
    [999_400, "999 mil"],
    [999_600, "1 mi"],
    [1_000_000, "1 mi"],
    [1_340_000, "1,3 mi"],
  ])("%d → %s", (n, label) => expect(fmtFollowers(n)).toBe(label));
});

describe("followersLabel", () => {
  it("sem audiência registrada não vira 0", () => {
    expect(followersLabel(0)).toBeNull();
    expect(followersLabel(null)).toBeNull();
    expect(followersLabel(undefined)).toBeNull();
    expect(followersLabel(Number.NaN)).toBeNull();
  });
  it("com audiência, formata", () => expect(followersLabel(23_100)).toBe("23,1 mil"));
});

describe("engagementLabel", () => {
  it("mostra com vírgula e uma casa quando é confiável", () => {
    expect(engagementLabel(4_700, 4.2)).toBe("4,2%");
    expect(engagementLabel(10_000, 12)).toBe("12%");
  });
  it("não mostra sem dado confiável", () => {
    expect(engagementLabel(4_700, null)).toBeNull();
    expect(engagementLabel(4_700, 0)).toBeNull(); // 0,0% = ainda não medido
    expect(engagementLabel(0, 3)).toBeNull(); // sem audiência
    expect(engagementLabel(14, 5814.3)).toBeNull(); // acima de 100%: ruído
    expect(engagementLabel(14, Number.NaN)).toBeNull();
  });
});

describe("splitCategories", () => {
  it("até duas visíveis e o resto em +N", () => {
    expect(splitCategories(["A"])).toEqual({ shown: ["A"], extra: 0 });
    expect(splitCategories(["A", "B", "C", "D"])).toEqual({ shown: ["A", "B"], extra: 2 });
  });
});

describe("fmtDistance", () => {
  it("uma casa abaixo de 10 km, inteiro acima", () => {
    expect(fmtDistance(3.46)).toBe("3,5 km");
    expect(fmtDistance(48.2)).toBe("48 km");
  });
});
