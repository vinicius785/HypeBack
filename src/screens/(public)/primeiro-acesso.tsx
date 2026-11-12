import React from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { firstAccess } from "@/shared/services/auth";
import { saveAuthToken } from "@/lib/utils/api";
import {
  FIRST_ACCESS_CODE_LENGTH,
  FIRST_ACCESS_PASSWORD_MAX,
  FIRST_ACCESS_PASSWORD_MIN,
  describeFirstAccessError,
  normalizeFirstAccessCode,
  type FirstAccessErrorText,
} from "@/lib/auth/first-access";

import { AccountSuspendedNotice } from "@/components/workspace-state/account-suspended-notice";
import { Input } from "@/components/ui/input";
import { ErrorMessage } from "@/components/ui/error-message";
import { Button } from "@/components/ui/button";
import { InputPassword } from "@/components/ui/input-password";
import { toast } from "sonner";

/**
 * O roteador lê a busca como JSON: `code=123456` chega como NÚMERO (e `012345`, com zero à esquerda, como texto). Os dois
 * viram o texto do código; o resto (listas, objetos…) é ignorado.
 */
function searchText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export const Route = createFileRoute("/(public)/primeiro-acesso")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : "",
    code: searchText(search.code),
  }),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const firstAccessSchema = z
  .object({
    email: z.string().trim().nonempty("E-mail é obrigatório").regex(EMAIL_RE, "E-mail inválido"),
    code: z
      .string()
      .nonempty("Código é obrigatório")
      .regex(new RegExp(`^\\d{${FIRST_ACCESS_CODE_LENGTH}}$`), `Informe o código de ${FIRST_ACCESS_CODE_LENGTH} dígitos do e-mail`),
    password: z
      .string()
      .nonempty("Senha é obrigatória")
      .min(FIRST_ACCESS_PASSWORD_MIN, `Senha deve ter no mínimo ${FIRST_ACCESS_PASSWORD_MIN} caracteres`)
      .max(FIRST_ACCESS_PASSWORD_MAX, `Senha deve ter no máximo ${FIRST_ACCESS_PASSWORD_MAX} caracteres`),
    confirmPassword: z.string().nonempty("Confirmação de senha é obrigatória"),
  })
  .refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "As senhas não coincidem" });

type FirstAccessSchemaData = z.infer<typeof firstAccessSchema>;

/**
 * Primeiro acesso: o dono de uma conta criada pelo Admin chega pelo link do e-mail de convite
 * (`/primeiro-acesso?email=…&code=…`), define a senha e já entra (a resposta traz o token, guardado como no login).
 * Pública. E-mail e código vêm preenchidos da URL e continuam editáveis; o código sai da URL assim que é lido (troca da
 * entrada do histórico), para não ficar no histórico nem em links copiados.
 */
function RouteComponent() {
  const navigate = useNavigate();
  const { email: emailFromUrl, code: codeFromUrl } = useSearch({ from: "/(public)/primeiro-acesso" });
  const [serverText, setServerText] = React.useState<FirstAccessErrorText>({});

  // Lidos uma vez, na abertura: depois disso a URL não guarda mais o código.
  const initial = React.useRef({ email: emailFromUrl, code: normalizeFirstAccessCode(codeFromUrl) });

  React.useEffect(() => {
    if (!codeFromUrl) return;
    void navigate({ to: ".", search: { email: emailFromUrl, code: "" }, replace: true });
    // só na abertura: o código é lido uma única vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FirstAccessSchemaData>({
    resolver: zodResolver(firstAccessSchema),
    defaultValues: { email: initial.current.email, code: initial.current.code, password: "", confirmPassword: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FirstAccessSchemaData) => firstAccess({ email: data.email.trim(), code: data.code, password: data.password }),
    onSuccess: ({ token }) => {
      saveAuthToken(token);
      void navigate({ to: "/" });
    },
    onError: (error: Error) => {
      const text = describeFirstAccessError(error);
      setServerText(text);
      // Erro de rede ou de outro tipo sem texto próprio: o aviso vai no topo da tela, como no login.
      if (!text.form && !text.invalidInvite && !text.suspended && !text.fields) toast.error(error.message);
    },
  });

  return (
    <form
      className="flex w-full max-w-[400px] flex-col gap-7"
      noValidate
      onSubmit={handleSubmit((data) => {
        setServerText({});
        mutate(data);
      })}
    >
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.045em] text-neutral-950">Primeiro acesso</h1>

        <p className="text-[15.5px] leading-normal text-neutral-500">
          Defina a senha da sua conta no HypeApp. Você entra logo em seguida.
        </p>
      </div>

      {serverText.suspended ? <AccountSuspendedNotice message={serverText.suspended} /> : null}

      <div className="flex flex-col gap-4">
        <Input
          label="E-mail"
          type="email"
          autoComplete="username"
          placeholder="Digite seu e-mail"
          error={errors.email?.message ?? serverText.fields?.email}
          {...register("email")}
        />

        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <Input
              label="Código"
              inputMode="numeric"
              autoComplete="one-time-code"
              spellCheck={false}
              placeholder="123456"
              maxLength={FIRST_ACCESS_CODE_LENGTH}
              error={errors.code?.message ?? serverText.fields?.code}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value}
              onChange={(event) => field.onChange(normalizeFirstAccessCode(event.target.value))}
              onPaste={(event) => {
                event.preventDefault();
                field.onChange(normalizeFirstAccessCode(event.clipboardData.getData("text")));
              }}
            />
          )}
        />

        <InputPassword
          label="Nova senha"
          autoComplete="new-password"
          placeholder={`Mínimo ${FIRST_ACCESS_PASSWORD_MIN} caracteres`}
          error={errors.password?.message ?? serverText.fields?.password}
          {...register("password")}
        />

        <InputPassword
          label="Confirmar senha"
          autoComplete="new-password"
          placeholder="Digite a senha novamente"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </div>

      {serverText.invalidInvite ? (
        <div className="flex flex-col gap-1.5">
          <ErrorMessage
            message="Este convite expirou ou o código está errado. Peça um novo convite à equipe do HypeApp ou use Esqueci a senha."
            className="!text-[13.5px] !text-danger-600"
          />
          <Link to="/forgot-password" className="w-fit text-[13.5px] font-semibold text-primary-600 hover:underline">
            Esqueci a senha
          </Link>
        </div>
      ) : null}
      {serverText.form ? <ErrorMessage message={serverText.form} className="!text-[13.5px] !text-danger-600" /> : null}

      <div className="flex flex-col gap-5 w-full">
        <Button type="submit" disabled={isPending} className="h-[58px] w-full min-w-full text-[15.5px]">
          {isPending ? "Entrando..." : "Definir senha e entrar"}
        </Button>

        <p className="text-center text-[14.5px] text-neutral-500">
          Já definiu sua senha?{" "}
          <Link to="/sign-in" className="font-semibold text-primary-600 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </form>
  );
}
