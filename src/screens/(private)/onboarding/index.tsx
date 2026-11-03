import { useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/contexts/auth-context";
import { isPhoneVerificationOn } from "@/lib/onboarding/flow";
import { updatePhone, updateCurrentUserProfile, uploadProfilePhoto } from "@/shared/services/me";
import { cleanPhoneNumber, formatDateBr, formatPhoneNumber, parseBrDate } from "@/lib/utils/format";

import { ImageUpload } from "@/components/image-upload";
import { OnboardingHeader } from "@/components/onboarding/onboarding-header";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/(private)/onboarding/")({
  component: RouteComponent,
});

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Com a confirmação do telefone ligada o telefone é obrigatório (é ele que recebe o código); desligada, é opcional. */
function buildProfileSchema(phoneRequired: boolean) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, "Informe seu nome completo")
      .max(100, "Nome deve ter no máximo 100 caracteres"),
    birthDate: z
      .string()
      .refine((value) => parseBrDate(value) !== null, "Informe uma data válida, como 25/03/1992"),
    phone: z
      .string()
      .refine((value) => {
        const digits = cleanPhoneNumber(value);
        if (digits.length === 0) return !phoneRequired;
        return digits.length >= 10 && digits.length <= 11;
      }, phoneRequired ? "Informe um telefone com DDD (10 ou 11 dígitos)" : "Telefone deve ter 10 ou 11 dígitos, com DDD"),
    photo: z
      .instanceof(FileList)
      .optional()
      .refine((files) => !files || files.length === 0 || files[0]?.size <= PHOTO_MAX_BYTES, "A foto deve ter no máximo 5 MB")
      .refine(
        (files) => !files || files.length === 0 || ["image/jpeg", "image/jpg", "image/png"].includes(files[0]?.type || ""),
        "Apenas fotos JPG e PNG são permitidas",
      ),
  });
}

type ProfileValues = z.infer<ReturnType<typeof buildProfileSchema>>;

function RouteComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setUser } = useAuth();
  const phoneVerification = isPhoneVerificationOn();
  const [preview, setPreview] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(buildProfileSchema(phoneVerification)),
    defaultValues: { name: user?.name ?? "", birthDate: "", phone: user?.phone ?? "" },
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (values: ProfileValues) => {
      const phone = cleanPhoneNumber(values.phone);
      // Com a confirmação ligada o telefone só é gravado pelo código; desligada, vai direto no perfil.
      let updated = await updateCurrentUserProfile({
        name: values.name,
        birth_date: parseBrDate(values.birthDate)!,
        ...(phone && !phoneVerification ? { phone } : {}),
      });

      let photoFailed = false;
      const file = values.photo?.[0];
      if (file) {
        try {
          updated = await uploadProfilePhoto(file);
        } catch {
          photoFailed = true;
        }
      }

      if (phone && phoneVerification) {
        await updatePhone({ phone });
        updated = { ...updated, phone };
      }
      return { updated, photoFailed, verify: phoneVerification && !!phone };
    },
    onSuccess: ({ updated, photoFailed, verify }) => {
      setUser(updated);
      // O layout das telas privadas decide pelo usuário em cache: sem gravar o perfil novo antes de navegar, ele ainda
      // veria a conta sem perfil e devolveria a pessoa para cá.
      queryClient.setQueryData(["get-current-user"], updated);
      if (photoFailed) toast.error("Perfil salvo, mas a foto não foi enviada. Você pode trocá-la depois em Configurações.");
      if (verify) {
        toast.success("Código de verificação enviado com sucesso.");
        navigate({ to: "/onboarding/verify-phone" });
      } else {
        navigate({ to: "/" });
      }
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : (error as { message?: string })?.message || "Não foi possível salvar o perfil.");
    },
  });

  return (
    <form className="ob-form ob-screen" onSubmit={handleSubmit((values) => save(values))}>
      <OnboardingHeader
        title="Crie seu perfil"
        description="Conte um pouco sobre você. É assim que as pessoas da sua equipe vão te reconhecer no Hype."
      />

      <div className="ob-logo">
        <ImageUpload
          id="profile-photo"
          size={88}
          register={register("photo")}
          preview={preview}
          setPreview={setPreview}
          onRemove={() => setValue("photo", undefined)}
        />
        <div>
          <b>Foto de perfil</b>
          {errors.photo?.message ? <ErrorMessage message={errors.photo.message} /> : <small>JPG ou PNG, até 5 MB. É opcional.</small>}
        </div>
      </div>

      <div className="ob-fields">
        <Input
          id="name"
          type="text"
          label="Nome completo"
          placeholder="Como você se chama"
          autoComplete="name"
          disabled={isPending}
          error={errors.name?.message}
          {...register("name")}
        />

        <Input id="email" type="email" label="E-mail" value={user?.email ?? ""} readOnly disabled />

        <div className="ob-pair">
          <Controller
            control={control}
            name="birthDate"
            render={({ field }) => (
              <Input
                id="birthDate"
                ref={field.ref}
                type="text"
                inputMode="numeric"
                autoComplete="bday"
                label="Data de nascimento"
                placeholder="dd/mm/aaaa"
                disabled={isPending}
                error={errors.birthDate?.message}
                value={field.value}
                onChange={(event) => field.onChange(formatDateBr(event.target.value))}
                onBlur={field.onBlur}
              />
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <Input
                id="phone"
                ref={field.ref}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                label={phoneVerification ? "Telefone com DDD" : "Telefone (opcional)"}
                placeholder="(11) 99999-9999"
                disabled={isPending}
                error={errors.phone?.message}
                value={formatPhoneNumber(field.value)}
                onChange={(event) => field.onChange(formatPhoneNumber(event.target.value))}
                onBlur={field.onBlur}
              />
            )}
          />
        </div>
      </div>

      <Button type="submit" className="ob-primary" disabled={isPending}>
        {isPending ? "Salvando..." : phoneVerification ? "Enviar código" : "Salvar e continuar"}
        {!isPending && <Icon name="ArrowRight" size={18} color="currentColor" />}
      </Button>
    </form>
  );
}
