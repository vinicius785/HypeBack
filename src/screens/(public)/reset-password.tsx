import React from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { resetPassword } from "@/shared/services/auth";

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

const CODE_LENGTH = 6;

/** Código de verificação em quadradinhos: um dígito por caixa, cola o código inteiro, Backspace volta e as setas andam. */
function CodeBoxes({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (next: string) => void;
}) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const labelId = React.useId();
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? "");

  const focusBox = (i: number) => refs.current[Math.min(Math.max(i, 0), CODE_LENGTH - 1)]?.focus();

  // Escreve `typed` a partir da caixa `from` (um dígito digitado, vários colados ou o código inteiro do SMS/e-mail).
  const write = (from: number, typed: string) => {
    const only = typed.replace(/\D/g, "");
    if (!only) return;
    const next = digits.slice();
    let last = from;
    for (let k = 0; k < only.length && from + k < CODE_LENGTH; k++) {
      next[from + k] = only[k];
      last = from + k;
    }
    onChange(next.join(""));
    focusBox(last + 1);
  };

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-[13px] font-semibold text-neutral-700">
        {label}
      </span>

      <div role="group" aria-labelledby={labelId} className="grid grid-cols-6 gap-2">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={digit}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Dígito ${i + 1} de ${CODE_LENGTH}`}
            aria-invalid={error ? true : undefined}
            maxLength={CODE_LENGTH}
            placeholder="·"
            className="h-[56px] w-full min-w-0 rounded-2xl bg-[color:var(--au-field,#fff)] text-center text-[22px] font-semibold text-neutral-950 outline-none ring-2 ring-transparent transition-all duration-150 placeholder:text-neutral-300 focus:ring-primary-600 aria-[invalid=true]:ring-danger-500 [&:-webkit-autofill]:!rounded-2xl"
            onFocus={(e) => e.target.select()}
            onChange={(e) => write(i, e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              write(0, e.clipboardData.getData("text"));
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault();
                const next = digits.slice();
                if (next[i]) {
                  next[i] = "";
                  onChange(next.join("").replace(/\s/g, ""));
                } else if (i > 0) {
                  next[i - 1] = "";
                  onChange(next.join(""));
                  focusBox(i - 1);
                }
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                focusBox(i - 1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                focusBox(i + 1);
              }
            }}
          />
        ))}
      </div>

      {error && <ErrorMessage message={error} />}
    </div>
  );
}

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

      <div className="flex flex-col gap-4">
        {email && (
          <Input
            label="E-mail"
            value={email}
            disabled
            // `className` substitui o do <input> inteiro (o Input espalha as props depois): repete a base e só muda a cor do texto,
            // senão o campo perde o fundo transparente e a altura e aparece como um bloco claro dentro da pílula.
            className="w-full h-full rounded-full outline-none bg-transparent text-neutral-500 cursor-not-allowed"
          />
        )}

        <CodeBoxes
          label="Código de verificação"
          value={codeValue}
          error={errors.code?.message}
          onChange={(next) => setValue("code", next, { shouldValidate: !!errors.code })}
        />

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

      <div className="flex flex-col gap-5 w-full">
        <Button type="submit" disabled={isResettingPassword} className="h-[58px] w-full min-w-full text-[15.5px]">
          {isResettingPassword ? "Redefinindo..." : "Redefinir senha"}
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
