import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/text-area";
import { postPublicCampaignInviteDecline } from "@/shared/services/public-campaign-invite";

const declineFormSchema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  phone: z
    .string()
    .min(1, "Celular é obrigatório")
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Informe o celular com DDD"),
  decline_reason: z
    .string()
    .refine((s) => s.trim().length >= 5, "Escreva pelo menos algumas palavras sobre o motivo")
    .refine((s) => s.trim().length <= 4000, "Texto muito longo"),
});

type DeclineForm = z.infer<typeof declineFormSchema>;

interface CampaignInviteDeclineModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignPublicId: string;
  onDeclineRecorded: () => void;
}

export function CampaignInviteDeclineModal({
  isOpen,
  onClose,
  campaignPublicId,
  onDeclineRecorded,
}: CampaignInviteDeclineModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DeclineForm>({
    resolver: zodResolver(declineFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      decline_reason: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const declineMutation = useMutation({
    mutationFn: (data: DeclineForm) =>
      postPublicCampaignInviteDecline(campaignPublicId, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        decline_reason: data.decline_reason.trim(),
      }),
    onSuccess: () => {
      toast.success("Registramos sua recusa e seus dados. Obrigado pelo retorno.");
      onDeclineRecorded();
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao enviar. Tente novamente.");
    },
  });

  if (!isOpen) return null;

  return (
    <Modal
      title="Recusar convite"
      onClose={onClose}
      panelClassName="max-w-lg"
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-neutral-600 leading-relaxed">
          Para recusar, precisamos de um <strong>pré-cadastro</strong> (identificação) e de uma{" "}
          <strong>mensagem aberta</strong> explicando por que você não vai participar desta campanha
          — isso ajuda a marca a entender o contexto.
        </p>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((data) => declineMutation.mutate(data))}
        >
          <Input
            label="Nome completo"
            autoComplete="name"
            error={errors.name?.message}
            {...register("name")}
          />
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Celular (com DDD)"
            type="tel"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            error={errors.phone?.message}
            {...register("phone")}
          />
          <Textarea
            id="decline_reason"
            label="Por que você não aceitou o convite?"
            placeholder="Ex.: não tenho tempo neste período, o nicho não combina com meu perfil, valores…"
            className="min-h-[120px]"
            error={errors.decline_reason?.message}
            {...register("decline_reason")}
          />
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:flex-1 min-w-0"
              onClick={onClose}
              disabled={declineMutation.isPending}
            >
              Voltar
            </Button>
            <Button
              type="submit"
              variant="default"
              className="w-full sm:flex-1 min-w-0 bg-neutral-700 hover:bg-neutral-800"
              disabled={declineMutation.isPending}
            >
              {declineMutation.isPending ? "Enviando…" : "Enviar recusa"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
