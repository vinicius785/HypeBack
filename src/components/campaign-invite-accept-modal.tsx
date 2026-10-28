import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon, type IconName } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import {
  confirmInstagramVerify,
  getBackendOrigin,
  getSocialConnectRedirect,
  postPublicCampaignInvitePreRegister,
  startInstagramVerify,
  type PublicCampaignInviteData,
  type SocialConnectMessage,
} from "@/shared/services/public-campaign-invite";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import { formatBrazilianPhoneInput } from "@/shared/utils/masks";
import {
  HYPEAPP_ANDROID_PLAY_STORE_URL,
  HYPEAPP_IOS_APP_STORE_URL,
  resolveHypeAppDownloadUrl,
} from "@/shared/config/app-links";

function hrefOpenHypeappApp(): string {
  if (typeof navigator === "undefined") return HYPEAPP_IOS_APP_STORE_URL;
  return resolveHypeAppDownloadUrl(
    navigator.userAgent,
    navigator.maxTouchPoints,
  );
}

/** Dados de identificação (name/email/phone). Redes são verificadas à parte. */
const identitySchema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  phone: z
    .string()
    .min(1, "Celular é obrigatório")
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Informe o celular com DDD"),
});

type IdentityFormValues = z.infer<typeof identitySchema>;

/** Estado de verificação de uma rede (token emitido pelo backend). */
interface VerifiedAccount {
  token: string;
  username: string;
  followers?: number | null;
}

const NETWORK_ICON: Record<string, IconName> = {
  instagram: "Instagram",
  youtube: "Youtube",
  tiktok: "Music2",
};

/**
 * Abre o popup de forma síncrona (dentro do gesto do clique, evita bloqueio),
 * navega para a `auth_url` e resolve quando o callback devolve o token via
 * `postMessage` — validando a origem contra o backend.
 */
function connectViaPopup(
  campaignPublicId: string,
  network: "tiktok" | "youtube",
): Promise<VerifiedAccount> {
  return new Promise<VerifiedAccount>((resolve, reject) => {
    const popup = window.open(
      "",
      "hypeapp-social-connect",
      "width=520,height=680,menubar=no,toolbar=no,location=no,status=no",
    );
    if (!popup) {
      reject(new Error("Popup bloqueado. Permita popups e tente novamente."));
      return;
    }

    const backendOrigin = getBackendOrigin();
    let settled = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
    };

    const onMessage = (event: MessageEvent) => {
      // Só aceita mensagens da página de callback servida pelo backend.
      if (backendOrigin && event.origin !== backendOrigin) return;
      const data = event.data as SocialConnectMessage | undefined;
      if (!data || data.type !== "hypeapp:social-connect") return;
      if (data.network && data.network !== network) return;

      settled = true;
      cleanup();
      try {
        popup.close();
      } catch {
        /* noop */
      }

      if (data.ok && data.verification_token) {
        resolve({
          token: data.verification_token,
          username: data.username ?? "",
          followers: data.followers ?? null,
        });
      } else {
        reject(new Error(data.error || "Não foi possível conectar a conta."));
      }
    };

    window.addEventListener("message", onMessage);

    // Detecta o fechamento do popup sem mensagem (usuário desistiu).
    const timer = window.setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        reject(new Error("Conexão cancelada."));
      }
    }, 600);

    // Navega o popup já aberto (mantém o gesto do usuário).
    getSocialConnectRedirect(campaignPublicId, network)
      .then(({ auth_url }) => {
        if (!settled) popup.location.href = auth_url;
      })
      .catch((err) => {
        settled = true;
        cleanup();
        try {
          popup.close();
        } catch {
          /* noop */
        }
        reject(err instanceof Error ? err : new Error("Falha ao iniciar a conexão."));
      });
  });
}

interface NetworkConnectRowProps {
  campaignPublicId: string;
  network: string;
  verified?: VerifiedAccount;
  onVerified: (network: string, account: VerifiedAccount) => void;
}

/** Linha de conexão de UMA rede. OAuth (TikTok/YouTube) ou bio-code (Instagram). */
function NetworkConnectRow({
  campaignPublicId,
  network,
  verified,
  onVerified,
}: NetworkConnectRowProps) {
  const label = getNetworkLabel(network, network);
  const iconName = NETWORK_ICON[network] ?? "Link";

  const [connecting, setConnecting] = useState(false);
  // Estado do desafio de bio (apenas Instagram).
  const [igUsername, setIgUsername] = useState("");
  const [igCode, setIgCode] = useState<string | null>(null);
  const [igInstructions, setIgInstructions] = useState("");
  const [igBusy, setIgBusy] = useState(false);

  const isInstagram = network === "instagram";

  const handleOAuthConnect = async () => {
    setConnecting(true);
    try {
      const account = await connectViaPopup(
        campaignPublicId,
        network as "tiktok" | "youtube",
      );
      onVerified(network, account);
      toast.success(`${label} conectado como @${account.username}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível conectar.");
    } finally {
      setConnecting(false);
    }
  };

  const handleIgStart = async () => {
    const clean = igUsername.trim().replace(/^@+/, "").toLowerCase();
    if (!clean) {
      toast.error("Informe seu @ do Instagram.");
      return;
    }
    setIgBusy(true);
    try {
      const res = await startInstagramVerify(campaignPublicId, clean);
      setIgCode(res.code);
      setIgInstructions(res.instructions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar.");
    } finally {
      setIgBusy(false);
    }
  };

  const handleIgConfirm = async () => {
    const clean = igUsername.trim().replace(/^@+/, "").toLowerCase();
    setIgBusy(true);
    try {
      const res = await confirmInstagramVerify(campaignPublicId, clean);
      onVerified(network, {
        token: res.verification_token,
        username: res.username,
        followers: res.followers,
      });
      toast.success(`Instagram verificado como @${res.username}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível verificar.");
    } finally {
      setIgBusy(false);
    }
  };

  if (verified) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <span className="flex items-center gap-2 min-w-0">
          <Icon name={iconName} size={18} color="#059669" className="shrink-0" />
          <span className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-neutral-950">{label}</span>
            <span className="text-xs text-neutral-500 truncate">@{verified.username}</span>
          </span>
        </span>
        <span className="flex items-center gap-1 text-emerald-700 text-xs font-medium shrink-0">
          <Icon name="CircleCheck" size={16} color="#059669" />
          Verificado
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 px-3 py-2.5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Icon name={iconName} size={18} color="#404040" className="shrink-0" />
          <span className="text-sm font-medium text-neutral-950">{label}</span>
        </span>
        {!isInstagram && (
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={handleOAuthConnect}
            disabled={connecting}
          >
            {connecting ? "Conectando…" : "Conectar"}
          </Button>
        )}
      </div>

      {isInstagram && (
        <div className="flex flex-col gap-2">
          <Input
            label="Seu @ do Instagram"
            placeholder="ex.: maria.silva"
            value={igUsername}
            onChange={(e) => setIgUsername(e.target.value)}
            disabled={igBusy || !!igCode}
          />
          {!igCode ? (
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-full"
              onClick={handleIgStart}
              disabled={igBusy}
            >
              {igBusy ? "Gerando código…" : "Gerar código de verificação"}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
                <p className="leading-relaxed">{igInstructions}</p>
                <p className="mt-1 font-mono text-base font-semibold text-neutral-950">
                  {igCode}
                </p>
              </div>
              <Button
                type="button"
                className="w-full min-w-full"
                onClick={handleIgConfirm}
                disabled={igBusy}
              >
                {igBusy ? "Verificando…" : "Já colei o código — verificar"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CampaignInviteAcceptModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignPublicId: string;
  campaignTitle: string;
  inviteData: PublicCampaignInviteData;
}

export function CampaignInviteAcceptModal({
  isOpen,
  onClose,
  campaignPublicId,
  campaignTitle,
  inviteData,
}: CampaignInviteAcceptModalProps) {
  const [preRegisterSuccess, setPreRegisterSuccess] = useState(false);
  const [verified, setVerified] = useState<Record<string, VerifiedAccount>>({});

  const allowedNetworks = useMemo(
    () => inviteData.allowed_social_networks ?? [],
    [inviteData.allowed_social_networks],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: { name: "", email: "", phone: "" },
  });

  useEffect(() => {
    if (isOpen) {
      reset({ name: "", email: "", phone: "" });
      setVerified({});
      setPreRegisterSuccess(false);
    }
  }, [isOpen, reset]);

  const missingNetworks = allowedNetworks.filter((n) => !verified[n]);
  const allConnected = missingNetworks.length === 0;

  const preRegisterMutation = useMutation({
    mutationFn: (data: IdentityFormValues) => {
      const verification_tokens = allowedNetworks
        .map((n) => verified[n]?.token)
        .filter((t): t is string => !!t);
      return postPublicCampaignInvitePreRegister(campaignPublicId, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        verification_tokens: verification_tokens.length ? verification_tokens : undefined,
      });
    },
    onSuccess: () => {
      setPreRegisterSuccess(true);
      toast.success("Pré-cadastro concluído! Você entrou nas inscrições desta campanha.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao enviar pré-cadastro.");
    },
  });

  const onSubmit = (data: IdentityFormValues) => {
    if (!allConnected) {
      toast.error("Conecte todas as redes exigidas para continuar.");
      return;
    }
    preRegisterMutation.mutate(data);
  };

  const handleVerified = (network: string, account: VerifiedAccount) => {
    setVerified((prev) => ({ ...prev, [network]: account }));
  };

  if (!isOpen) return null;

  return (
    <Modal
      title={preRegisterSuccess ? "Continue no app" : "Pré-cadastro no convite"}
      onClose={onClose}
      panelClassName="max-w-lg"
    >
      {preRegisterSuccess ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-neutral-600 leading-relaxed">
            Seus dados foram registrados e você foi vinculado à campanha{" "}
            <span className="font-medium text-neutral-950">{campaignTitle}</span> em{" "}
            <strong>inscrições</strong>. Baixe ou abra o app Hypeapp para acompanhar e concluir as
            próximas etapas.
          </p>
          <a
            href={hrefOpenHypeappApp()}
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center min-h-11 px-6 rounded-2xl font-medium text-sm bg-primary-600 hover:bg-primary-700 text-white transition-colors w-full min-w-full text-center"
          >
            Abrir no app Hypeapp
          </a>
          <Button type="button" variant="outline" className="w-full min-w-full" onClick={onClose}>
            Fechar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-neutral-600 leading-relaxed">
            Preencha seus dados e <strong>conecte</strong> as contas das redes desta campanha. A
            conexão confirma que o perfil é seu. Ao concluir, você entra nas{" "}
            <strong>inscrições</strong>.
          </p>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit(onSubmit)}
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
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <Input
                  id={field.name}
                  name={field.name}
                  label="Celular (com DDD)"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="(11) 99999-9999"
                  error={errors.phone?.message}
                  value={field.value}
                  onChange={(e) => field.onChange(formatBrazilianPhoneInput(e.target.value))}
                  onBlur={field.onBlur}
                />
              )}
            />

            {allowedNetworks.length > 0 && (
              <div className="flex flex-col gap-3 pt-1 border-t border-neutral-100">
                <div>
                  <p className="text-sm font-medium text-neutral-950">Conecte suas contas</p>
                  <p className="text-xs text-neutral-500">
                    Conecte cada rede participante para comprovar a posse do perfil.
                  </p>
                </div>
                {allowedNetworks.map((net) => (
                  <NetworkConnectRow
                    key={net}
                    campaignPublicId={campaignPublicId}
                    network={net}
                    verified={verified[net]}
                    onVerified={handleVerified}
                  />
                ))}
              </div>
            )}

            <Button
              type="submit"
              className="w-full min-w-full mt-1"
              disabled={preRegisterMutation.isPending || !allConnected}
            >
              {preRegisterMutation.isPending
                ? "Enviando…"
                : !allConnected
                  ? `Conecte ${missingNetworks.length} rede(s) para continuar`
                  : "Confirmar e aceitar convite"}
            </Button>
          </form>
          <div className="border-t border-neutral-100 pt-4 flex flex-col gap-3">
            <p className="text-xs text-neutral-500 text-center">
              Já tem conta no Hypeapp como influenciador ou prefere instalar antes?{" "} <br />
              <a
                href={hrefOpenHypeappApp()}
                rel="noopener noreferrer"
                className="text-primary-700 font-medium hover:underline"
              >
                Baixar o app Hypeapp
              </a>
            </p>
            <div className="flex items-center justify-center gap-4 text-xs">
              <a
                href={HYPEAPP_IOS_APP_STORE_URL}
                rel="noopener noreferrer"
                className="text-primary-700 font-medium hover:underline"
              >
                App Store
              </a>
              <a
                href={HYPEAPP_ANDROID_PLAY_STORE_URL}
                rel="noopener noreferrer"
                className="text-primary-700 font-medium hover:underline"
              >
                Google Play
              </a>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
