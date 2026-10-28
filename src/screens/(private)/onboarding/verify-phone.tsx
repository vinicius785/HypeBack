import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/contexts/auth-context";
import { formatPhoneNumber } from "@/lib/utils/format";
import { updatePhone, verifyPhone } from "@/shared/services/me";
import { getMyWorkspaces } from "@/shared/services/workspace";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/(private)/onboarding/verify-phone")({
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
        const workspaces = await queryClient.fetchQuery({
          queryKey: ["me-workspaces"],
          queryFn: getMyWorkspaces,
        });
        if (workspaces.length > 0) {
          navigate({ to: "/", replace: true });
        } else {
          navigate({ to: "/onboarding/create-workspace" });
        }
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
      className="max-w-md w-full flex flex-col gap-6"
      onSubmit={handleSubmit((data) =>
        verifyPhoneMutation({ ...data, phone: user?.phone || "" })
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-medium text-neutral-950">
          Código de verificação
        </h1>

        <p className="text-neutral-600 text-center">
          Digite o código de verificação enviado para seu número de telefone{" "}
          <span className="font-medium text-neutral-950">
            {formatPhoneNumber(user?.phone || "")}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-4 mt-10">
        <Input
          type="text"
          label="Código de verificação"
          placeholder="123456"
          disabled={isVerifyingPhone}
          error={errors.code?.message}
          {...register("code")}
        />
      </div>

      <div className="flex flex-col gap-4">
        <Button type="submit" disabled={isVerifyingPhone || isUpdatingPhone}>
          <p className="text-neutral-50 font-semibold">
            {isVerifyingPhone ? "Verificando..." : "Verificar"}
          </p>
        </Button>

        <Button
          type="button"
          variant="ghost"
          disabled={isVerifyingPhone || isUpdatingPhone}
          onClick={() => updatePhoneMutation({ phone: user?.phone || "" })}
        >
          <p className="text-neutral-700 font-semibold">
            {isUpdatingPhone ? "Reenviando código..." : "Reenviar código"}
          </p>
        </Button>

        <Button
          type="button"
          variant="ghost"
          disabled={isVerifyingPhone || isUpdatingPhone}
          onClick={() => navigate({ to: "/onboarding" })}
        >
          <p className="text-neutral-700 font-semibold">
            Editar número de telefone
          </p>
        </Button>
      </div>
    </form>
  );
}
