import React from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { StaffResetError, resetPassword, staffResetPassword } from "@/shared/services/auth";
import { describeStaffResetError, type StaffResetErrorText } from "@/lib/auth/staff-reset";
import { EMAIL_PASSWORD_MIN, STAFF_PASSWORD_MAX, normalizeResetCode, passwordMinFor, resetCodeKind } from "@/lib/auth/reset-code";

import { Input } from "@/components/ui/input";
import { ErrorMessage } from "@/components/ui/error-message";
import { Button } from "@/components/ui/button";
import { InputPassword } from "@/components/ui/input-password";
import { toast } from "sonner";

export const Route = createFileRoute("/(public)/reset-password")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      email: (search.email as string) || "",
    };
  },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resetPasswordSchema = z
  .object({
    // Só é pedido quando falta (o "Esqueci a senha" já manda o e-mail na URL) e só vale para o código de admin.
    email: z.string(),
    code: z.string().nonempty("Código é obrigatório"),
    password: z
      .string()
      .nonempty("Senha é obrigatória")
      .max(STAFF_PASSWORD_MAX, `Senha deve ter no máximo ${STAFF_PASSWORD_MAX} caracteres`),
    confirmPassword: z.string().nonempty("Confirmação de senha é obrigatória"),
  })
  .superRefine((data, ctx) => {
    const kind = resetCodeKind(data.code);
    if (data.code && kind === "incomplete") {
      ctx.addIssue({ code: "custom", path: ["code"], message: "Informe o código de 6 dígitos do e-mail ou o código de admin (XXXX-XXXX-XXXX)" });
    }
    if (data.password && data.password.length < passwordMinFor(kind)) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: `Senha deve ter no mínimo ${passwordMinFor(kind)} caracteres${kind === "staff" ? " (conta da equipe)" : ""}`,
      });
    }
    if (kind === "staff" && !EMAIL_RE.test(data.email.trim())) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Informe o e-mail da sua conta" });
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "As senhas não coincidem" });
    }
  });

type ResetPasswordSchemaData = z.infer<typeof resetPasswordSchema>;

/**
 * Redefinir senha, para qualquer conta, numa tela só. O campo de código aceita o código de 6 dígitos enviado por e-mail OU o
 * código de 12 caracteres que um admin gera para a equipe: o formato decide o endpoint, e a tela não revela de que tipo é a
 * conta (a API responde igual a qualquer e-mail no "Esqueci a senha"). O código nunca vem da URL.
 */
function RouteComponent() {
  const navigate = useNavigate();
  const { email: emailFromSearch } = useSearch({ from: "/(public)/reset-password" });
  const [success, setSuccess] = React.useState(false);
  const [serverText, setServerText] = React.useState<StaffResetErrorText>({});

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ResetPasswordSchemaData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: emailFromSearch,
      code: "",
      password: "",
      confirmPassword: "",
    },
  });

  const kind = resetCodeKind(watch("code"));

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: ResetPasswordSchemaData) =>
      resetCodeKind(data.code) === "staff"
        ? staffResetPassword({ email: data.email.trim(), code: data.code, password: data.password })
        : resetPassword({ code: data.code, password: data.password }),
    onSuccess: (data) => {
      setSuccess(true);
      toast.success(data.message || "Senha redefinida com sucesso!");
      // Redirecionar para login após 2 segundos (as sessões antigas da conta caíram: é preciso entrar de novo)
      setTimeout(() => {
        navigate({ to: "/sign-in" });
      }, 2000);
    },
    onError: (error: Error) => {
      if (error instanceof StaffResetError) setServerText(describeStaffResetError(error));
      else toast.error(error.message || "Erro ao redefinir senha");
    },
  });

  if (success) {
    return (
      <div className="max-w-[400px] w-full flex flex-col gap-7 items-center">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.045em] text-neutral-950">
            Senha redefinida com sucesso!
          </h1>
          <p className="text-[15.5px] leading-normal text-neutral-500">
            Redirecionando para o login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      className="max-w-[400px] w-full flex flex-col gap-7"
      noValidate
      onSubmit={handleSubmit((data) => {
        setServerText({});
        mutate(data);
      })}
    >
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.045em] text-neutral-950">
          Redefinir senha
        </h1>

        <p className="text-[15.5px] leading-normal text-neutral-500">
          Digite o código de 6 dígitos enviado para o seu e-mail e a nova senha. Conta da equipe? Use o código gerado por um admin.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {emailFromSearch ? (
          <Input
            label="E-mail"
            value={emailFromSearch}
            disabled
            // `className` substitui o do <input> inteiro (o Input espalha as props depois): repete a base e só muda a cor do texto,
            // senão o campo perde o fundo transparente e a altura e aparece como um bloco claro dentro da pílula.
            className="w-full h-full rounded-full outline-none bg-transparent text-neutral-500 cursor-not-allowed"
          />
        ) : (
          <Input
            label="E-mail"
            type="email"
            autoComplete="username"
            placeholder="Digite seu e-mail"
            error={errors.email?.message ?? serverText.fields?.email}
            {...register("email")}
          />
        )}

        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <Input
              label="Código"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="123456 ou XXXX-XXXX-XXXX"
              maxLength={14}
              error={errors.code?.message ?? serverText.fields?.code}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value}
              onChange={(event) => field.onChange(normalizeResetCode(event.target.value))}
              onPaste={(event) => {
                // Cola com ou sem hífens e em qualquer caixa: mostra já no formato certo.
                event.preventDefault();
                field.onChange(normalizeResetCode(event.clipboardData.getData("text")));
              }}
            />
          )}
        />

        <InputPassword
          label="Nova senha"
          autoComplete="new-password"
          placeholder={`Mínimo ${kind === "staff" ? passwordMinFor("staff") : EMAIL_PASSWORD_MIN} caracteres`}
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

      {serverText.form ? <ErrorMessage message={serverText.form} className="!text-[13.5px] !text-danger-600" /> : null}

      <div className="flex flex-col gap-5 w-full">
        <Button type="submit" disabled={isPending} className="h-[58px] w-full min-w-full text-[15.5px]">
          {isPending ? "Redefinindo..." : "Redefinir senha"}
        </Button>

        <div className="flex flex-col gap-2 text-center text-[14.5px] text-neutral-500">
          <p>
            Não recebeu o código?{" "}
            <Link to="/forgot-password" className="font-semibold text-primary-600 hover:underline">
              Solicitar novo código
            </Link>
          </p>
          <p>
            Lembrou da sua senha?{" "}
            <Link to="/sign-in" className="font-semibold text-primary-600 hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </form>
  );
}
