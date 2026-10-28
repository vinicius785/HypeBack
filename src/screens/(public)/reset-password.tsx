import React from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { resetPassword } from "@/shared/services/auth";

import { Input } from "@/components/ui/input";
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

const resetPasswordSchema = z
  .object({
    code: z
      .string()
      .nonempty("Código é obrigatório")
      .regex(/^\d{6}$/, "Código deve ter exatamente 6 dígitos"),
    password: z
      .string()
      .nonempty("Senha é obrigatória")
      .min(8, "Senha deve ter no mínimo 8 caracteres")
      .max(255, "Senha deve ter no máximo 255 caracteres"),
    confirmPassword: z.string().nonempty("Confirmação de senha é obrigatória"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type ResetPasswordSchemaData = z.infer<typeof resetPasswordSchema>;

function RouteComponent() {
  const navigate = useNavigate();
  const { email } = useSearch({ from: "/(public)/reset-password" });
  const [success, setSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ResetPasswordSchemaData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      code: "",
      password: "",
      confirmPassword: "",
    },
  });

  const codeValue = watch("code");

  const {
    mutate: resetPasswordMutation,
    isPending: isResettingPassword,
  } = useMutation({
    mutationFn: resetPassword,
    onSuccess: (data) => {
      setSuccess(true);
      toast.success(data.message || "Senha redefinida com sucesso!");
      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate({ to: "/sign-in" });
      }, 2000);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao redefinir senha");
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
      onSubmit={handleSubmit((data) =>
        resetPasswordMutation({
          code: data.code,
          password: data.password,
        })
      )}
    >
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.045em] text-neutral-950">
          Redefinir senha
        </h1>

        <p className="text-[15.5px] leading-normal text-neutral-500">
          Digite o código de 6 dígitos enviado para seu email e sua nova senha
        </p>
      </div>

      <div className="flex flex-col gap-4 mt-10">
        {email && (
          <Input
            label="E-mail"
            value={email}
            disabled
            className="bg-neutral-100"
          />
        )}

        <Input
          label="Código de verificação (6 dígitos)"
          error={errors.code?.message}
          placeholder="000000"
          maxLength={6}
          value={codeValue}
          onChange={(e) => {
            // Apenas números, máximo 6 dígitos
            const value = e.target.value.replace(/\D/g, "").slice(0, 6);
            setValue("code", value, { shouldValidate: true });
          }}
        />
        <p className="text-xs text-neutral-600 -mt-2">
          Digite o código de 6 dígitos enviado para seu email
        </p>

        <InputPassword
          label="Nova senha"
          placeholder="Mínimo 8 caracteres"
          error={errors.password?.message}
          {...register("password")}
        />

        <InputPassword
          label="Confirmar senha"
          placeholder="Digite a senha novamente"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </div>

      <div className="flex flex-col gap-4">
        <Button type="submit" disabled={isResettingPassword}>
          <p className="text-neutral-50 font-semibold">
            {isResettingPassword ? "Redefinindo..." : "Redefinir senha"}
          </p>
        </Button>

        <Link to="/forgot-password" className="text-center">
          <span className="text-neutral-700 font-semibold">
            Não recebeu o código?{" "}
            <span className="text-primary-600 font-medium">
              Solicitar novo código
            </span>
          </span>
        </Link>

        <Link to="/sign-in" className="text-center">
          <span className="text-neutral-700 font-semibold">
            Lembrou da sua senha?{" "}
            <span className="text-primary-600 font-medium">Entrar</span>
          </span>
        </Link>
      </div>
    </form>
  );
}
