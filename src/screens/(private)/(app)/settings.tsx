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
  /** Somente leitura por regra do produto (não é só estado temporário de envio). */
  locked?: boolean;
  autoComplete?: string;
  inputMode?: "email" | "tel" | "text";
  onChange?: (v: string) => void;
}

/** `mpFd` do protótipo. Campo editável = branco com borda; somente leitura = cinza com cadeado. */
function Field({ id, label, value, placeholder, error, type, pre, readOnly, locked, autoComplete, inputMode, onChange }: FieldProps) {
  return (
    <div className={`mpx-fd ${error ? "bad" : ""}`}>
      <label htmlFor={id}>
        {label}
        {locked ? <em>Somente leitura</em> : null}
      </label>
      <div className={`mpx-in ${locked ? "ro" : ""}`}>
        {pre ? <span>{pre}</span> : null}
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          readOnly={readOnly || locked}
          aria-readonly={locked ? true : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          autoComplete={autoComplete ?? "off"}
          inputMode={inputMode}
          onChange={(e) => onChange?.(e.target.value)}
        />
        {locked ? <I n="lock" cls="mpx-lock" /> : null}
      </div>
      {error ? (
        <small id={`${id}-err`} role="alert">
          {error}
        </small>
      ) : null}
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
      const message = e instanceof Error ? e.message : "Não foi possível salvar as alterações.";
      // Conflito de e-mail volta da API como mensagem; mostra junto do campo.
      if (/e-?mail/i.test(message)) setErr((p) => ({ ...p, e: message }));
      else toast.error(message);
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
            <aside className="mpx-side">
              <div className="mpx-id">
                <div className="mpx-av">
                  {photo && !photoBroken ? (
                    <img src={photo} alt="" onError={() => setPhotoBroken(true)} />
                  ) : (
                    <span>{initialsOf(user.name)}</span>
                  )}
                </div>
                <div className="mpx-who">
                  <b>{user.name}</b>
                  <small>{user.email}</small>
                  {roleLabel ? <span className="mpx-rl">{roleLabel}</span> : null}
                </div>
              </div>
              {workspaces.length > 0 ? (
                <section className="mpx-wc" aria-labelledby="mpx-ws-h">
                  <h3 id="mpx-ws-h">
                    Workspaces
                    <em>{workspaces.length}</em>
                  </h3>
                  <ul className="mpx-wl" tabIndex={0} aria-label="Lista de workspaces">
                    {workspaces.map((w) => {
                      const wp = w.photo ? getUploadUrl(w.photo) : undefined;
                      const current = w.id === selectedWorkspace?.id;
                      return (
                        <li key={w.id} className={current ? "cur" : ""}>
                          <span className="brand">
                            {wp ? (
                              <img src={wp} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              initialsOf(w.name)
                            )}
                          </span>
                          <span className="wt">
                            <b>{w.name}</b>
                            <small>{w.role ? (ROLE_LABEL[w.role] ?? w.role) : ""}</small>
                          </span>
                          {current ? <span className="tag">Atual</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
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
                    autoComplete="name"
                    readOnly={isPending}
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
                    autoComplete="email"
                    inputMode="email"
                    readOnly={isPending}
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
                    locked
                  />
                </div>
                <div className="mpx-ac">
                  <span className={`mpx-st${dirty ? " dirty" : ""}`} role="status" aria-live="polite">
                    {isPending ? (
                      "Salvando…"
                    ) : dirty ? (
                      <>
                        <i className="dot" aria-hidden="true" />
                        Você tem alterações não salvas
                      </>
                    ) : (
                      <>
                        <I n="check" cls="sm" />
                        Tudo salvo
                      </>
                    )}
                  </span>
                  <button type="button" className="btn" disabled={!dirty || isPending} aria-busy={isPending} onClick={save}>
                    {isPending ? <I n="refresh" cls="sm spin" /> : <I n="check" cls="sm" />}
                    {isPending ? "Salvando…" : "Salvar alterações"}
                  </button>
                </div>
              </section>
              <section className="mpx-cd mpx-out" aria-label="Sair da conta">
                <div className="mpx-rw">
                  <span aria-hidden="true">
                    <I n="logout" />
                  </span>
                  <div>
                    <b>Sair da conta</b>
                    <small>Você precisará entrar de novo para acessar o HypeApp.</small>
                  </div>
                  <button type="button" className="btn sair" onClick={() => doLogout()}>
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
