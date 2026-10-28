import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { getUploadUrl, removeAuthToken } from "@/lib/utils/api";
import { formatPhoneNumber } from "@/lib/utils/format";
import { logout } from "@/shared/services/auth";
import { updateCurrentUserProfile } from "@/shared/services/me";
import type { WorkspaceRole } from "@/shared/types";

import { I } from "@/components/prototype/ui";

export const Route = createFileRoute("/(private)/(app)/settings")({
  component: SettingsScreen,
});

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  aprovador: "Aprovador",
  observador: "Observador",
  juridico: "Jurídico",
  financeiro: "Financeiro",
  analista: "Analista",
};

const BRAND_COLORS = ["#9e2cfa", "#050505", "#7e7e7e"];

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

interface FieldProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  type?: string;
  pre?: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
}

/** `mpFd` do protótipo. */
function Field({ id, label, value, placeholder, error, type, pre, readOnly, onChange }: FieldProps) {
  return (
    <div className={`mpx-fd ${error ? "bad" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className={`mpx-in ${pre ? "pre" : ""}`}>
        {pre ? <span>{pre}</span> : null}
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          autoComplete="off"
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
      {error ? <small>{error}</small> : null}
    </div>
  );
}

function SettingsScreen() {
  const { user, setUser } = useAuth();
  const { workspaces, selectedWorkspace } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [err, setErr] = useState<{ n?: string; e?: string }>({});
  const [photoBroken, setPhotoBroken] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
    }
  }, [user]);

  const photo = user?.avatar ? getUploadUrl(user.avatar) : undefined;
  useEffect(() => setPhotoBroken(false), [photo]);

  const { mutate, isPending } = useMutation({
    mutationFn: updateCurrentUserProfile,
    onSuccess: (updated) => {
      setUser(updated);
      void queryClient.invalidateQueries({ queryKey: ["get-current-user"] });
      toast.success("Alterações salvas");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar as alterações.");
    },
  });

  const { mutate: doLogout } = useMutation({
    mutationFn: logout,
    onSettled: () => {
      removeAuthToken();
      setUser(null);
      navigate({ to: "/sign-in", replace: true });
    },
  });

  if (!user) return null;

  const dirty = name.trim() !== (user.name ?? "") || email.trim() !== (user.email ?? "");

  const save = () => {
    const er: { n?: string; e?: string } = {};
    if (name.trim().length < 2) er.n = "Informe seu nome";
    else if (name.trim().length > 120) er.n = "Nome muito longo";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) er.e = "Digite um e-mail válido";
    setErr(er);
    if (er.n || er.e) return;
    mutate({ name: name.trim(), email: email.trim() });
  };

  const clear = (k: "n" | "e") => setErr((p) => ({ ...p, [k]: undefined }));
  const roleLabel = selectedWorkspace?.role
    ? (ROLE_LABEL[selectedWorkspace.role] ?? selectedWorkspace.role)
    : "";

  return (
    <div className="pv">
      <div className="wrap" style={{ maxWidth: "none" }}>
        <div className="head fade">
          <div>
            <h1>Meu perfil</h1>
            <p>Seus dados de acesso ao HypeApp.</p>
          </div>
        </div>
        <div className="fade">
          <div className="mpx-g">
            <aside className="mpx-id">
              <div className="mpx-av">
                {photo && !photoBroken ? (
                  <img
                    src={photo}
                    alt=""
                    style={{ width: 132, height: 132 }}
                    onError={() => setPhotoBroken(true)}
                  />
                ) : (
                  <span style={{ width: 132, height: 132 }}>{initialsOf(user.name)}</span>
                )}
              </div>
              <b>{user.name}</b>
              <small>{user.email}</small>
              {roleLabel ? <span className="mpx-rl">{roleLabel}</span> : null}
              {workspaces.length > 0 ? (
                <div className="mpx-ws">
                  <small>Workspaces</small>
                  {workspaces.map((w, i) => {
                    const wp = w.photo ? getUploadUrl(w.photo) : undefined;
                    return (
                      <div key={w.id}>
                        <span
                          className="brand"
                          style={{ background: BRAND_COLORS[i % BRAND_COLORS.length], overflow: "hidden" }}
                        >
                          {wp ? (
                            <img src={wp} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            initialsOf(w.name)
                          )}
                        </span>
                        <div>
                          <b>{w.name}</b>
                          <small>{w.role ? (ROLE_LABEL[w.role] ?? w.role) : ""}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </aside>
            <div className="mpx-cl">
              <section className="mpx-cd">
                <div className="mpx-h">
                  <h3>Dados pessoais</h3>
                  <p>Como você aparece para a sua equipe e para os criadores.</p>
                </div>
                <div className="mpx-fs">
                  <Field
                    id="mpn"
                    label="Nome completo"
                    value={name}
                    placeholder="Como você se chama"
                    error={err.n}
                    onChange={(v) => {
                      setName(v);
                      clear("n");
                    }}
                  />
                  <Field
                    id="mpe"
                    label="E-mail"
                    type="email"
                    value={email}
                    placeholder="voce@email.com"
                    error={err.e}
                    onChange={(v) => {
                      setEmail(v);
                      clear("e");
                    }}
                  />
                  <Field
                    id="mpt"
                    label="Celular com DDD"
                    value={user.phone ? formatPhoneNumber(user.phone) : ""}
                    placeholder="Não informado"
                    pre="BR +55"
                    readOnly
                  />
                </div>
                <div className="mpx-ac">
                  <small>{dirty ? "Você tem alterações não salvas" : "Tudo salvo"}</small>
                  <button type="button" className="btn" disabled={!dirty || isPending} onClick={save}>
                    <I n="check" cls="sm" />
                    {isPending ? "Salvando…" : "Salvar alterações"}
                  </button>
                </div>
              </section>
              <section className="mpx-cd mpx-out">
                <div className="mpx-rw">
                  <span>
                    <I n="x" />
                  </span>
                  <div>
                    <b>Sair da conta</b>
                    <small>Você precisará entrar de novo para acessar o HypeApp.</small>
                  </div>
                  <button type="button" className="btn dng" onClick={() => doLogout()}>
                    Sair
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
