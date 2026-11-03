import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/contexts/auth-context";
import { isPhoneVerificationOn } from "@/lib/onboarding/flow";
import { updatePhone } from "@/shared/services/me";
import { cleanPhoneNumber, formatPhoneNumber } from "@/lib/utils/format";

import { OnboardingHeader } from "@/components/onboarding/onboarding-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/(private)/onboarding/")({
  // Sem a confirmação do telefone (lib/onboarding/flow.ts) esta etapa não existe: segue direto para a marca.
  beforeLoad: () => {
    if (!isPhoneVerificationOn()) throw redirect({ to: "/onboarding/create-workspace", replace: true });
  },
  component: RouteComponent,
});

const updatePhoneSchema = z.object({
  phone: z
    .string()
    .min(1, "Número de telefone é obrigatório")
    .refine((phone) => {
      const numbers = cleanPhoneNumber(phone);
      return numbers.length >= 10 && numbers.length <= 11;
    }, "Número de telefone deve ter 10 ou 11 dígitos")
    .transform((phone) => {
      return cleanPhoneNumber(phone);
    }),
});

type UpdatePhoneData = z.infer<typeof updatePhoneSchema>;

function RouteComponent() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePhoneData>({
    resolver: zodResolver(updatePhoneSchema),
    defaultValues: {
      phone: user?.phone || "",
    },
  });

  const { mutate: updatePhoneMutation, isPending: isUpdatingPhone } =
    useMutation({
      mutationFn: updatePhone,
      onSuccess: (_, data) => {
        setUser({ ...user!, phone: data.phone });
        navigate({ to: "/onboarding/verify-phone" });
        toast.success("Código de verificação enviado com sucesso.");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  return (
    <form
      className="ob-form ob-screen"
      onSubmit={handleSubmit((data) => updatePhoneMutation(data))}
    >
      <OnboardingHeader
        title="Qual é o seu telefone?"
        description="Vamos enviar um código por WhatsApp para confirmar que o número é seu."
      />

      <div className="ob-fields">
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange: onChangePhone, onBlur, value } }) => (
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              label="Telefone com DDD"
              placeholder="(11) 99999-9999"
              disabled={isUpdatingPhone}
              error={errors.phone?.message}
              onChange={(event) => {
                const maskedValue = formatPhoneNumber(event.target.value);
                onChangePhone(maskedValue);
              }}
              onBlur={onBlur}
              value={formatPhoneNumber(value)}
            />
          )}
        />
      </div>

      <Button type="submit" className="ob-primary" disabled={isUpdatingPhone}>
        {isUpdatingPhone ? "Enviando código..." : "Enviar código"}
        {!isUpdatingPhone && <Icon name="ArrowRight" size={18} color="currentColor" />}
      </Button>
    </form>
  );
}
