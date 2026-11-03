import { afterEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/shared/types";

import {
  currentOnboardingStep,
  isPhoneVerificationOn,
  needsWorkspaceCheck,
  onboardingRedirectFor,
  onboardingSteps,
  stepStatuses,
} from "./flow";

const NEW_ACCOUNT: User = {
  id: 1,
  name: "Ana",
  email: "ana@marca.com",
  phone: null,
  created_at: "",
  updated_at: "",
};
const WITH_PHONE: User = { ...NEW_ACCOUNT, phone: "11992922135" };
const STAFF: User = { ...NEW_ACCOUNT, is_platform_admin: true, platform_role: "admin" };

afterEach(() => vi.unstubAllEnvs());

describe("isPhoneVerificationOn", () => {
  it("vem desligada: sem a variável, nada pede o código do WhatsApp", () => {
    expect(isPhoneVerificationOn()).toBe(false);
  });

  it("só liga com VITE_PHONE_VERIFICATION=on (qualquer outro valor mantém desligada)", () => {
    vi.stubEnv("VITE_PHONE_VERIFICATION", "on");
    expect(isPhoneVerificationOn()).toBe(true);
    for (const off of ["", "off", "true", "1", "ON"]) {
      vi.stubEnv("VITE_PHONE_VERIFICATION", off);
      expect(isPhoneVerificationOn()).toBe(false);
    }
  });
});

describe("onboardingSteps", () => {
  it("sem a confirmação: só as etapas da marca", () => {
    expect(onboardingSteps(false).map((s) => s.id)).toEqual(["brand", "company"]);
  });

  it("com a confirmação: telefone e código vêm antes", () => {
    expect(onboardingSteps(true).map((s) => s.id)).toEqual(["phone", "code", "brand", "company"]);
  });

  it("o padrão segue a chave", () => {
    expect(onboardingSteps().map((s) => s.id)).toEqual(["brand", "company"]);
    vi.stubEnv("VITE_PHONE_VERIFICATION", "on");
    expect(onboardingSteps()).toHaveLength(4);
  });

  it("toda etapa tem título e descrição", () => {
    for (const step of onboardingSteps(true)) {
      expect(step.title).not.toBe("");
      expect(step.hint).not.toBe("");
    }
  });
});

describe("currentOnboardingStep", () => {
  it("cada tela do fluxo corresponde a uma etapa", () => {
    expect(currentOnboardingStep("/onboarding")).toBe("phone");
    expect(currentOnboardingStep("/onboarding/verify-phone")).toBe("code");
    expect(currentOnboardingStep("/onboarding/create-workspace")).toBe("brand");
    expect(currentOnboardingStep("/onboarding/welcome")).toBe("done");
  });

  it("a criação da marca tem duas etapas: ?etapa=empresa mostra os dados da empresa", () => {
    expect(currentOnboardingStep("/onboarding/create-workspace", { etapa: "empresa" })).toBe("company");
    expect(currentOnboardingStep("/onboarding/create-workspace", { etapa: "outra" })).toBe("brand");
    expect(currentOnboardingStep("/onboarding/create-workspace", {})).toBe("brand");
  });

  it("ignora a barra final e responde null fora do fluxo", () => {
    expect(currentOnboardingStep("/onboarding/")).toBe("phone");
    expect(currentOnboardingStep("/onboarding/create-workspace/")).toBe("brand");
    expect(currentOnboardingStep("/campaigns")).toBeNull();
  });
});

describe("stepStatuses", () => {
  const steps = onboardingSteps(true);

  it("marca o que ficou para trás, a etapa atual e o que falta", () => {
    expect(stepStatuses(steps, "brand")).toEqual(["done", "done", "current", "upcoming"]);
    expect(stepStatuses(steps, "phone")).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(stepStatuses(steps, "company")).toEqual(["done", "done", "done", "current"]);
  });

  it("na tela de boas-vindas tudo está concluído", () => {
    expect(stepStatuses(steps, "done")).toEqual(["done", "done", "done", "done"]);
  });

  it("numa etapa que a lista não tem (ou fora do fluxo) nada está concluído", () => {
    expect(stepStatuses(onboardingSteps(false), "phone")).toEqual(["upcoming", "upcoming"]);
    expect(stepStatuses(steps, null)).toEqual(["upcoming", "upcoming", "upcoming", "upcoming"]);
  });
});

describe("onboardingRedirectFor", () => {
  const at = (pathname: string) => ({ pathname });

  describe("com a confirmação do telefone ligada (comportamento de sempre)", () => {
    const on = { phoneVerification: true };

    it("conta sem telefone vai para o primeiro passo, tenha marca ou não", () => {
      expect(onboardingRedirectFor({ user: NEW_ACCOUNT, workspaceCount: 0, ...at("/"), ...on })).toBe("/onboarding");
      expect(onboardingRedirectFor({ user: NEW_ACCOUNT, workspaceCount: 2, ...at("/campaigns"), ...on })).toBe("/onboarding");
      expect(onboardingRedirectFor({ user: NEW_ACCOUNT, workspaceCount: undefined, ...at("/"), ...on })).toBe("/onboarding");
    });

    it("quem tem telefone, ou já está no fluxo, fica onde está", () => {
      expect(onboardingRedirectFor({ user: WITH_PHONE, workspaceCount: 0, ...at("/"), ...on })).toBeNull();
      expect(onboardingRedirectFor({ user: NEW_ACCOUNT, workspaceCount: 0, ...at("/onboarding/verify-phone"), ...on })).toBeNull();
    });
  });

  describe("com a confirmação desligada", () => {
    const off = { phoneVerification: false };

    it("conta nova, sem marca, vai direto criar a marca", () => {
      expect(onboardingRedirectFor({ user: NEW_ACCOUNT, workspaceCount: 0, ...at("/"), ...off })).toBe(
        "/onboarding/create-workspace",
      );
      expect(onboardingRedirectFor({ user: NEW_ACCOUNT, workspaceCount: 0, ...at("/campaigns"), ...off })).toBe(
        "/onboarding/create-workspace",
      );
    });

    it("espera a lista de marcas chegar: sem ela (ou com erro na API) ninguém é desviado", () => {
      expect(onboardingRedirectFor({ user: NEW_ACCOUNT, workspaceCount: undefined, ...at("/"), ...off })).toBeNull();
    });

    it("quem já tem marca entra no app, mesmo sem telefone", () => {
      expect(onboardingRedirectFor({ user: NEW_ACCOUNT, workspaceCount: 1, ...at("/"), ...off })).toBeNull();
    });

    it("a equipe da plataforma nunca é levada para a criação de marca", () => {
      expect(onboardingRedirectFor({ user: STAFF, workspaceCount: 0, ...at("/admin/dashboard"), ...off })).toBeNull();
    });

    it("quem tem telefone, quem está sem sessão e quem já está no fluxo ficam onde estão", () => {
      expect(onboardingRedirectFor({ user: WITH_PHONE, workspaceCount: 0, ...at("/"), ...off })).toBeNull();
      expect(onboardingRedirectFor({ user: null, workspaceCount: 0, ...at("/"), ...off })).toBeNull();
      expect(onboardingRedirectFor({ user: NEW_ACCOUNT, workspaceCount: 0, ...at("/onboarding/create-workspace"), ...off })).toBeNull();
    });
  });

  it("o padrão segue a chave de ambiente", () => {
    const input = { user: NEW_ACCOUNT, workspaceCount: 0, pathname: "/" };
    expect(onboardingRedirectFor(input)).toBe("/onboarding/create-workspace");
    vi.stubEnv("VITE_PHONE_VERIFICATION", "on");
    expect(onboardingRedirectFor(input)).toBe("/onboarding");
  });
});

describe("needsWorkspaceCheck", () => {
  it("só consulta as marcas quando a confirmação está desligada e a conta pode ser nova", () => {
    expect(needsWorkspaceCheck(NEW_ACCOUNT, false)).toBe(true);
    expect(needsWorkspaceCheck(NEW_ACCOUNT, true)).toBe(false);
    expect(needsWorkspaceCheck(WITH_PHONE, false)).toBe(false);
    expect(needsWorkspaceCheck(STAFF, false)).toBe(false);
    expect(needsWorkspaceCheck(null, false)).toBe(false);
  });
});
