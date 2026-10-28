import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { signUp } from "@/shared/services/auth";
import { saveAuthToken } from "@/lib/utils/api";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputPassword } from "@/components/ui/input-password";
import { toast } from "sonner";

export const Route = createFileRoute("/(public)/sign-up")({
  component: RouteComponent,
});

const registerSchema = z
  .object({
    name: z
      .string()
      .nonempty("Nome é obrigatório")
      .min(8, "O nome completo deve ter no mínimo 8 caracteres"),
    email: z
      .string()
      .nonempty("Email é obrigatório")
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email inválido"),
    password: z
      .string()
      .nonempty("Senha é obrigatória")
      .min(8, "Senha deve ter no mínimo 8 caracteres"),
    password_confirmation: z
      .string()
      .nonempty("Confirmação de senha é obrigatória")
      .min(8, "Senha deve ter no mínimo 8 caracteres"),
  })
  .refine((data) => data.password === data.password_confirmation, {
    path: ["password_confirmation"],
    message: "As senhas não coincidem",
  });

type RegisterSchemaData = z.infer<typeof registerSchema>;

function RouteComponent() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterSchemaData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      password_confirmation: "",
    },
  });

  const { mutate: signUpMutation, isPending: isCreatingAccount } = useMutation({
    mutationFn: signUp,
    onSuccess: async ({ token }) => {
      saveAuthToken(token);
      navigate({ to: "/" });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar conta");
    },
  });

  return (
    <form
      className="max-w-[400px] w-full flex flex-col gap-7"
      onSubmit={handleSubmit((data) => signUpMutation(data))}
    >
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.045em] text-neutral-950">
          Criar uma conta
        </h1>

        <p className="text-[15.5px] leading-normal text-neutral-500">
          Digite suas informações abaixo para criar sua conta
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          label="Nome completo"
          error={errors.name?.message}
          placeholder="Digite seu nome completo"
          {...register("name")}
        />

        <Input
          label="E-mail"
          error={errors.email?.message}
          placeholder="Digite seu e-mail"
          {...register("email")}
        />

        <InputPassword
          label="Senha"
          placeholder="********"
          error={errors.password?.message}
          {...register("password")}
        />

        <InputPassword
          label="Confirmar senha"
          placeholder="********"
          error={errors.password_confirmation?.message}
          {...register("password_confirmation")}
        />
      </div>

      <div className="flex flex-col gap-4">
        <Button type="submit" disabled={isCreatingAccount}>
          <p className="text-neutral-50 font-semibold">
            {isCreatingAccount ? "Criando conta..." : "Criar conta"}
          </p>
        </Button>

        <Link to="/sign-in" className="text-center">
          <span className="text-neutral-700 font-semibold">
            Já tem uma conta?{" "}
            <span className="text-primary-600 font-medium">Entrar</span>
          </span>
        </Link>
      </div>
    </form>
  );
}
