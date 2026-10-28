import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import {
  AccessPicker,
  CoverPicker,
  GroupCardPv,
  NameDescRules,
  OfficialSwitch,
  PvOverlay,
  useGroupForm,
} from "@/components/groups/pv-group";
import { useCreateGroup, useUploadGroupCover } from "@/hooks/use-groups";

export const Route = createFileRoute(
  "/(private)/(admin)/admin/groups/new" as "/(private)/(admin)/admin/groups/new",
)({
  component: NewGroup,
});

const STEPS: [string, string][] = [
  ["Detalhes", "Capa, nome e descrição"],
  ["Acesso", "Quem pode entrar"],
];

function NewGroup() {
  const navigate = useNavigate();
  const createMutation = useCreateGroup();
  const uploadCover = useUploadGroupCover();
  const f = useGroupForm();
  const [step, setStep] = useState(0);

  const isSubmitting = createMutation.isPending || uploadCover.isPending;
  const close = () => {
    if (!isSubmitting) navigate({ to: "/admin/groups" });
  };

  const step0Bad = !!(f.errors.name || f.errors.description || f.errors.rules);

  const go = (k: number) => {
    if (k > step && step0Bad) {
      f.setTried(true);
      return;
    }
    f.setTried(false);
    setStep(k);
  };

  const submit = async () => {
    f.setTried(true);
    if (Object.keys(f.errors).length > 0) {
      if (step0Bad) setStep(0);
      toast.error("Corrija os campos destacados antes de continuar.");
      return;
    }
    const values = f.payload();
    try {
      // Upload deferido: sobe a capa (se houver) ANTES de criar o grupo.
      let coverUrl: string | null = null;
      if (f.coverFile) {
        try {
          const uploaded = await uploadCover.mutateAsync(f.coverFile);
          coverUrl = uploaded.url;
        } catch {
          toast.warning("Não foi possível enviar a capa; criando sem ela.");
        }
      }
      const group = await createMutation.mutateAsync({
        name: values.name,
        description: values.description,
        cover_url: coverUrl,
        is_official: values.is_official,
        rules: values.rules,
        required_level: values.required_level,
        required_hype_points: values.required_hype_points,
      });
      toast.success("Grupo criado");
      navigate({ to: "/admin/groups/$groupId", params: { groupId: group.id } });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível criar o grupo.",
      );
    }
  };

  const level = f.v.levelOn ? Number.parseInt(f.v.level, 10) || null : null;
  const hype = f.v.hypeOn ? Number.parseInt(f.v.hype, 10) || null : null;

  return (
    <PvOverlay onClose={close}>
      <section
        className="ovd on wide lvfm ntw gpf"
        role="dialog"
        aria-label="Criar grupo"
      >
        <div className="sh-h cm-h">
          <div>
            <small>Grupos</small>
            <h2>Criar grupo</h2>
          </div>
          <button type="button" className="round" onClick={close} aria-label="Fechar">
            <I n="x" cls="sm" />
          </button>
        </div>
        <div className="ntw-w">
          <div
            className="sh-seg lvf-sg gpx-fs"
            style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}
          >
            {STEPS.map(([t], k) => (
              <button
                key={t}
                type="button"
                className={`${step === k ? "on" : ""} ${k < step ? "dn" : ""}`}
                onClick={() => go(k)}
              >
                <span>{k < step ? <I n="check" cls="sm" /> : k + 1}</span>
                {t}
              </button>
            ))}
          </div>
          <div className="ntw-m">
            <div className="lvf-bd swp" key={step}>
              {step === 0 ? (
                <div className="gpx-s0">
                  <CoverPicker f={f} label="Capa do grupo" />
                  <NameDescRules f={f} className="gpx-sf" />
                </div>
              ) : (
                <>
                  <AccessPicker f={f} variant="opt" />
                  <div className="sh-c lvt-op">
                    <h4>Destaque</h4>
                    <OfficialSwitch f={f} />
                  </div>
                </>
              )}
            </div>
            <aside className="ntw-pv">
              <small className="ntw-pl">Como aparece no app</small>
              <GroupCardPv
                prev
                k={0}
                g={{
                  name: f.v.name,
                  description: f.v.description,
                  cover: f.preview,
                  official: f.v.official,
                  level,
                  hype,
                  members: 0,
                  posts: 0,
                  archived: false,
                }}
              />
            </aside>
          </div>
        </div>
        <div className="cm-f">
          {step ? (
            <button type="button" className="btn out" onClick={() => go(0)}>
              <I n="back" cls="sm" />
              Voltar
            </button>
          ) : (
            <small>{STEPS[0][1]}</small>
          )}
          <span style={{ flex: 1 }} />
          {step === STEPS.length - 1 ? (
            <button
              type="button"
              className="btn"
              onClick={submit}
              disabled={isSubmitting}
            >
              <I n="check" cls="sm" />
              {isSubmitting ? "Criando..." : "Criar grupo"}
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => go(1)}>
              Continuar
              <I n="chev" cls="sm" />
            </button>
          )}
        </div>
      </section>
    </PvOverlay>
  );
}
