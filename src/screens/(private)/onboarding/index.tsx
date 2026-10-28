import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/contexts/auth-context";
import { updatePhone } from "@/shared/services/me";
import { cleanPhoneNumber, formatPhoneNumber } from "@/lib/utils/format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/(private)/onboarding/")({
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
      className="max-w-md w-full flex flex-col gap-6"
      onSubmit={handleSubmit((data) => updatePhoneMutation(data))}
    >
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-medium text-neutral-950">
          Número de telefone
        </h1>

        <p className="text-neutral-600 text-center">
          Adicione seu número de telefone para continuar
        </p>
      </div>

      <div className="flex flex-col gap-4 mt-10">
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange: onChangePhone, onBlur, value } }) => (
            <Input
              type="tel"
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

      <Button type="submit" disabled={isUpdatingPhone}>
        <p className="text-neutral-50 font-semibold">
          {isUpdatingPhone ? "Enviando código de verificação..." : "Continuar"}
        </p>
      </Button>
    </form>
  );
}
