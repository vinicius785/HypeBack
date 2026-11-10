import { useState } from "react";
import { SIGNUP_ENABLED } from "@/shared/constants/signup";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { signIn } from "@/shared/services/auth";
import { saveAuthToken } from "@/lib/utils/api";
import { readWorkspaceStateError } from "@/lib/workspace-state/lifecycle-errors";

import { AccountSuspendedNotice } from "@/components/workspace-state/account-suspended-notice";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputPassword } from "@/components/ui/input-password";
import { toast } from "sonner";

export const Route = createFileRoute("/(public)/sign-in")({
  component: RouteComponent,
});

const signInSchema = z.object({
  email: z
    .string()
    .nonempty("E-mail é obrigatório")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "E-mail inválido"),
  password: z
    .string()
    .nonempty("Senha é obrigatória")
    .min(6, "Senha deve ter no mínimo 6 caracteres"),
});

type SignInSchemaData = z.infer<typeof signInSchema>;

function RouteComponent() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInSchemaData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Conta suspensa (403 ACCOUNT_SUSPENDED): o aviso fica na tela, com o caminho para o suporte.
  const [suspendedMessage, setSuspendedMessage] = useState<string | null>(null);

  const { mutate: signInMutation, isPending: isSigningIn } = useMutation({
    mutationFn: signIn,
    onSuccess: async ({ token }) => {
      saveAuthToken(token);
      navigate({ to: "/" });
    },
    onError: (error) => {
      const state = readWorkspaceStateError(error);
      if (state?.code === "ACCOUNT_SUSPENDED") {
        setSuspendedMessage(state.message);
        return;
      }
      toast.error(error.message || "Erro ao entrar na conta");
    },
  });

  return (
    <form
      className="flex w-full max-w-[400px] flex-col gap-7"
      onSubmit={handleSubmit((data) => {
        setSuspendedMessage(null);
        signInMutation(data);
      })}
    >
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.045em] text-neutral-950">
          Bem-vindo de volta
        </h1>

        <p className="text-[15.5px] leading-normal text-neutral-500">
          Entre para continuar no HypeApp.
        </p>
      </div>

      {suspendedMessage ? <AccountSuspendedNotice message={suspendedMessage} /> : null}

      <div className="flex flex-col gap-4">
        <Input
          label="E-mail"
          error={errors.email?.message}
          placeholder="Digite seu e-mail"
          {...register("email")}
        />

        <InputPassword
          label="Senha"
          placeholder="Digite sua senha"
          error={errors.password?.message}
          {...register("password")}
        />

        <Link
          to="/forgot-password"
          className="self-end text-[13px] font-semibold text-primary-600 hover:underline"
        >
          Esqueci a senha
        </Link>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <Button type="submit" disabled={isSigningIn} className="h-[58px] w-full min-w-full text-[15.5px]">
          {isSigningIn ? "Entrando..." : "Entrar"}
        </Button>

        {SIGNUP_ENABLED ? (
          <p className="text-center text-[14.5px] text-neutral-500">
            Ainda não tem conta?{" "}
            <Link to="/sign-up" className="font-semibold text-primary-600 hover:underline">
              Criar conta
            </Link>
          </p>
        ) : (
          <p className="text-center text-[14.5px] text-neutral-500">Novos cadastros estão temporariamente fechados.</p>
        )}
      </div>
    </form>
  );
}
