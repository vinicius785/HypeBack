import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Input } from "@/components/ui/input";
import { InputPassword } from "@/components/ui/input-password";
import {
  describeStaffResetError,
  isStaffCodeComplete,
  normalizeStaffCode,
  STAFF_PASSWORD_MAX,
  STAFF_PASSWORD_MIN,
  type StaffResetErrorText,
} from "@/lib/auth/staff-reset";
import { staffResetPassword } from "@/shared/services/auth";

export const Route = createFileRoute("/(public)/staff-reset-password")({
  component: RouteComponent,
});

const schema = z
  .object({
    email: z
      .string()
      .nonempty("E-mail é obrigatório")
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "E-mail inválido"),
    code: z
      .string()
      .nonempty("Código é obrigatório")
      .refine(isStaffCodeComplete, "O código tem 12 letras ou números (XXXX-XXXX-XXXX)"),
    password: z
      .string()
      .nonempty("Senha é obrigatória")
      .min(STAFF_PASSWORD_MIN, `A senha da equipe deve ter no mínimo ${STAFF_PASSWORD_MIN} caracteres`)
      .max(STAFF_PASSWORD_MAX, `A senha deve ter no máximo ${STAFF_PASSWORD_MAX} caracteres`),
    confirmPassword: z.string().nonempty("Confirmação de senha é obrigatória"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem",
  });

type FormData = z.infer<typeof schema>;

/**
 * Redefinir com código (pública): a equipe da plataforma não recebe e-mail de redefinição; um admin gera um código e a
 * pessoa o usa aqui, com o próprio e-mail, para definir a própria senha. Nada do que se digita é registrado, e o código
 * nunca vem da URL.
 */
function RouteComponent() {
  const navigate = useNavigate();
  const [serverText, setServerText] = useState<StaffResetErrorText>({});

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", code: "", password: "", confirmPassword: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: staffResetPassword,
    onSuccess: (data) => {
      // As sessões antigas da conta caíram: é preciso entrar de novo, com a senha nova.
      toast.success(data.message || "Senha redefinida com sucesso. Entre com a nova senha.");
      navigate({ to: "/sign-in" });
    },
    onError: (error) => setServerText(describeStaffResetError(error)),
  });

  return (
    <form
      className="flex w-full max-w-[400px] flex-col gap-7"
      noValidate
      onSubmit={handleSubmit((data) => {
        setServerText({});
        mutate({ email: data.email.trim(), code: data.code, password: data.password });
      })}
    >
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.045em] text-neutral-950">Redefinir com código</h1>
        <p className="text-[15.5px] leading-normal text-neutral-500">
          Contas da equipe: peça a um admin para gerar um código para você. Depois, use o seu e-mail e o código para definir uma nova senha.
        </p>
      </div>

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
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              placeholder="XXXX-XXXX-XXXX"
              maxLength={14}
              error={errors.code?.message ?? serverText.fields?.code}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value}
              onChange={(event) => field.onChange(normalizeStaffCode(event.target.value))}
              onPaste={(event) => {
                // Cola com ou sem hífens e em qualquer caixa: mostra já no formato certo.
                event.preventDefault();
                field.onChange(normalizeStaffCode(event.clipboardData.getData("text")));
              }}
            />
          )}
        />

        <InputPassword
          label="Nova senha"
          autoComplete="new-password"
          placeholder={`Mínimo ${STAFF_PASSWORD_MIN} caracteres`}
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

      {serverText.form ? (
        <ErrorMessage message={serverText.form} className="!text-[13.5px] !text-danger-600" />
      ) : null}

      <div className="flex w-full flex-col gap-5">
        <Button type="submit" disabled={isPending} className="h-[58px] w-full min-w-full text-[15.5px]">
          {isPending ? "Redefinindo..." : "Redefinir senha"}
        </Button>

        <p className="text-center text-[14.5px] text-neutral-500">
          Lembrou da sua senha?{" "}
          <Link to="/sign-in" className="font-semibold text-primary-600 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </form>
  );
}
