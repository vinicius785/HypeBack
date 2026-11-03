import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/contexts/auth-context";
import { isPhoneVerificationOn } from "@/lib/onboarding/flow";
import { formatPhoneNumber } from "@/lib/utils/format";
import { updatePhone, verifyPhone } from "@/shared/services/me";

import { OnboardingHeader } from "@/components/onboarding/onboarding-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/(private)/onboarding/verify-phone")({
  // Sem a confirmação do telefone (lib/onboarding/flow.ts) esta etapa não existe: volta para o perfil.
  beforeLoad: () => {
    if (!isPhoneVerificationOn()) throw redirect({ to: "/onboarding", replace: true });
  },
  component: RouteComponent,
});

const verifyPhoneSchema = z.object({
  code: z
    .string()
    .nonempty("Código de verificação é obrigatório")
    .min(6, "Código de verificação deve ter no mínimo 6 caracteres")
    .max(6, "Código de verificação deve ter no máximo 6 caracteres")
    .regex(/^\d{6}$/, "Código de verificação deve conter apenas números"),
});

type VerifyPhoneData = z.infer<typeof verifyPhoneSchema>;

function RouteComponent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyPhoneData>({
    resolver: zodResolver(verifyPhoneSchema),
    defaultValues: {
      code: "",
    },
  });

  const { mutate: verifyPhoneMutation, isPending: isVerifyingPhone } =
    useMutation({
      mutationFn: verifyPhone,
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["get-current-user"] });
        navigate({ to: "/", replace: true });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  const { mutate: updatePhoneMutation, isPending: isUpdatingPhone } =
    useMutation({
      mutationFn: updatePhone,
      onSuccess: () => {
        toast.success("Código de verificação reenviado com sucesso.");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  return (
    <form
      className="ob-form ob-screen"
      onSubmit={handleSubmit((data) =>
        verifyPhoneMutation({ ...data, phone: user?.phone || "" })
      )}
    >
      <OnboardingHeader
        title="Confirme seu telefone"
        description={
          <>
            Digite o código de 6 dígitos que enviamos por WhatsApp para{" "}
            <span className="whitespace-nowrap font-semibold text-neutral-950">
              {formatPhoneNumber(user?.phone || "")}
            </span>
            .
          </>
        }
      />

      <div className="ob-fields">
        <Input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          label="Código de verificação"
          placeholder="123456"
          disabled={isVerifyingPhone}
          error={errors.code?.message}
          {...register("code")}
        />
      </div>

      <div className="ob-actions">
        <Button type="submit" className="ob-primary" disabled={isVerifyingPhone || isUpdatingPhone}>
          {isVerifyingPhone ? "Verificando..." : "Verificar"}
          {!isVerifyingPhone && <Icon name="ArrowRight" size={18} color="currentColor" />}
        </Button>

        <button
          type="button"
          className="ob-link"
          disabled={isVerifyingPhone || isUpdatingPhone}
          onClick={() => updatePhoneMutation({ phone: user?.phone || "" })}
        >
          {isUpdatingPhone ? "Reenviando código..." : "Reenviar código"}
        </button>

        <button
          type="button"
          className="ob-link"
          disabled={isVerifyingPhone || isUpdatingPhone}
          onClick={() => navigate({ to: "/onboarding" })}
        >
          Editar número de telefone
        </button>
      </div>
    </form>
  );
}
