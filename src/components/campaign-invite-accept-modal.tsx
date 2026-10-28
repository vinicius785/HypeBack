import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  InviteField,
  InviteModalShell,
  InviteSummary,
  isEmail,
  isPhone,
} from "@/components/campaign-invite/parts";
import { I } from "@/components/prototype/ui";
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
} from "@/shared/config/app-links";

/** Estado de verificação de uma rede (token emitido pelo backend). */
interface VerifiedAccount {
  token: string;
  username: string;
  followers?: number | null;
}

const NETWORK_ICON: Record<string, string> = {
  instagram: "instagram",
  youtube: "youtube",
  tiktok: "tiktok",
};

function formatFollowers(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return String(n);
}

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

/** Verificação do Instagram por código na bio. */
function InstagramVerify({
  campaignPublicId,
  onVerified,
}: {
  campaignPublicId: string;
  onVerified: (account: VerifiedAccount) => void;
}) {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);

  const clean = username.trim().replace(/^@+/, "").toLowerCase();

  const start = async () => {
    if (!clean) {
      toast.error("Informe seu @ do Instagram.");
      return;
    }
    setBusy(true);
    try {
      const res = await startInstagramVerify(campaignPublicId, clean);
      setCode(res.code);
      setInstructions(res.instructions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await confirmInstagramVerify(campaignPublicId, clean);
      onVerified({ token: res.verification_token, username: res.username, followers: res.followers });
      toast.success(`Instagram verificado como @${res.username}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível verificar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cvm-sc">
      <h4>
        Instagram <em>verificação pela bio</em>
      </h4>
      <InviteField
        id="cvig"
        label="Seu @ do Instagram"
        value={username}
        onChange={setUsername}
        placeholder="maria.silva"
        prefix="@"
        disabled={busy || !!code}
      />
      {!code ? (
        <button type="button" className="btn out" onClick={start} disabled={busy}>
          {busy ? <i className="lvf-sp" /> : <I n="link" cls="sm" />}
          {busy ? "Gerando código…" : "Gerar código de verificação"}
        </button>
      ) : (
        <>
          <div className="cvm-tm">
            <div>
              <b style={{ fontFamily: "ui-monospace, monospace", letterSpacing: ".04em" }}>{code}</b>
              <small>{instructions}</small>
            </div>
          </div>
          <button type="button" className="btn" onClick={confirm} disabled={busy}>
            {busy ? <i className="lvf-sp" /> : <I n="check" cls="sm" />}
            {busy ? "Verificando…" : "Já colei o código, verificar"}
          </button>
        </>
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
  onAccepted?: () => void;
}

export function CampaignInviteAcceptModal(props: CampaignInviteAcceptModalProps) {
  if (!props.isOpen) return null;
  return <AcceptContent {...props} />;
}

function AcceptContent({
  onClose,
  campaignPublicId,
  campaignTitle,
  inviteData,
  onAccepted,
}: CampaignInviteAcceptModalProps) {
  const allowedNetworks = inviteData.allowed_social_networks ?? [];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState(false);
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [verified, setVerified] = useState<Record<string, VerifiedAccount>>({});

  const missingNetworks = allowedNetworks.filter((n) => !verified[n]);
  const allConnected = missingNetworks.length === 0;

  const nameErr = tried && name.trim().length < 2 ? "Informe seu nome" : "";
  const emailErr = tried && !isEmail(email) ? "Digite um e-mail válido" : "";
  const phoneErr = tried && !isPhone(phone) ? "Informe o celular com DDD" : "";

  const mutation = useMutation({
    mutationFn: () => {
      const verification_tokens = allowedNetworks
        .map((n) => verified[n]?.token)
        .filter((t): t is string => !!t);
      return postPublicCampaignInvitePreRegister(campaignPublicId, {
        name: name.trim(),
        email: email.trim(),
        phone,
        verification_tokens: verification_tokens.length ? verification_tokens : undefined,
      });
    },
    onSuccess: () => {
      setDone(true);
      onAccepted?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao enviar pré-cadastro.");
    },
  });

  const connect = async (network: string) => {
    setConnecting(network);
    try {
      const account = await connectViaPopup(campaignPublicId, network as "tiktok" | "youtube");
      setVerified((prev) => ({ ...prev, [network]: account }));
      toast.success(`${getNetworkLabel(network, network)} conectado como @${account.username}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível conectar.");
    } finally {
      setConnecting(null);
    }
  };

  const submit = () => {
    if (name.trim().length < 2 || !isEmail(email) || !isPhone(phone) || !allConnected || !terms) {
      setTried(true);
      return;
    }
    mutation.mutate();
  };

  if (done) {
    return (
      <InviteModalShell
        title="Convite aceito!"
        sub="Tudo certo"
        onClose={onClose}
        body={
          <div className="cvm-ok">
            <span>
              <I n="check" />
            </span>
            <h3>Convite aceito!</h3>
            <p>
              Você entrou nas inscrições de <b>{campaignTitle}</b>. Agora é só seguir estes três passos
              para começar a campanha.
            </p>
            <ol className="cvm-st">
              {[
                ["Baixe o app", "Disponível para iPhone e Android"],
                ["Entre com o seu e-mail", "Usamos o e-mail que você acabou de informar"],
                ["Acompanhe as etapas", "Roteiro, conteúdo e publicação ficam no app"],
              ].map(([a, b], i) => (
                <li key={a}>
                  <span>{i + 1}</span>
                  <div>
                    <b>{a}</b>
                    <small>{b}</small>
                  </div>
                </li>
              ))}
            </ol>
            <div className="cvm-ap">
              <a className="btn" href={HYPEAPP_IOS_APP_STORE_URL} rel="noopener noreferrer">
                App Store
              </a>
              <a className="btn out" href={HYPEAPP_ANDROID_PLAY_STORE_URL} rel="noopener noreferrer">
                Google Play
              </a>
            </div>
          </div>
        }
        foot={
          <>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn out" onClick={onClose}>
              Fechar
            </button>
          </>
        }
      />
    );
  }

  const instagramPending = allowedNetworks.includes("instagram") && !verified.instagram;

  return (
    <InviteModalShell
      title="Aceitar convite"
      sub="Falta pouco"
      onClose={onClose}
      body={
        <>
          <InviteSummary data={inviteData} />

          <div className="cvm-sc cvm-yo">
            <h4>Seus dados</h4>
            <InviteField
              id="cvn"
              label="Nome completo"
              value={name}
              onChange={setName}
              placeholder="Como você se chama"
              error={nameErr}
              autoComplete="name"
            />
            <InviteField
              id="cve"
              label="E-mail"
              value={email}
              onChange={setEmail}
              placeholder="voce@email.com"
              error={emailErr}
              type="email"
              autoComplete="email"
            />
            <InviteField
              id="cvp"
              label="Celular com DDD"
              value={phone}
              onChange={(v) => setPhone(formatBrazilianPhoneInput(v))}
              placeholder="(11) 99999-9999"
              error={phoneErr}
              prefix="BR +55"
              inputMode="numeric"
              type="tel"
              autoComplete="tel"
            />
          </div>

          {allowedNetworks.length > 0 && (
            <div className={`cvm-sc${tried && !allConnected ? " bad" : ""}`}>
              <h4>
                Suas redes <em>conecte {allowedNetworks.length > 1 ? "todas" : "a rede"} da campanha</em>
              </h4>
              <div className="cvm-ct">
                {allowedNetworks.map((net) => {
                  const v = verified[net];
                  const label = getNetworkLabel(net, net);
                  const followers = formatFollowers(v?.followers);
                  return (
                    <div key={net} className={v ? "on" : ""}>
                      <span>
                        <I n={NETWORK_ICON[net] ?? "link"} />
                      </span>
                      <div>
                        <b>{label}</b>
                        <small>
                          {v
                            ? `@${v.username}${followers ? ` · ${followers} seguidores` : ""}`
                            : net === "instagram"
                              ? "Confirme pelo código na bio"
                              : "Confirma o seu perfil"}
                        </small>
                      </div>
                      {v ? (
                        <em>
                          <I n="check" cls="sm" />
                          Conectado
                        </em>
                      ) : net !== "instagram" ? (
                        <button
                          type="button"
                          disabled={connecting === net}
                          onClick={() => connect(net)}
                        >
                          {connecting === net ? (
                            <>
                              <i className="lvf-sp" />
                              Conectando
                            </>
                          ) : (
                            "Conectar"
                          )}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {tried && !allConnected && (
                <small className="cvm-er">
                  Conecte {missingNetworks.length > 1 ? "as redes" : "a rede"} para continuar
                </small>
              )}
            </div>
          )}

          {instagramPending && (
            <InstagramVerify
              campaignPublicId={campaignPublicId}
              onVerified={(account) => setVerified((prev) => ({ ...prev, instagram: account }))}
            />
          )}

          <div className={`cvm-tm${tried && !terms ? " bad" : ""}`}>
            <div>
              <b>Termos de uso</b>
              <small>Li e concordo com os Termos e a Política de Privacidade.</small>
            </div>
            <button
              type="button"
              className={`tgl${terms ? " on" : ""}`}
              role="switch"
              aria-checked={terms}
              aria-label="Aceitar os termos"
              onClick={() => setTerms((t) => !t)}
            >
              <i />
            </button>
          </div>
          {tried && !terms && <small className="cvm-er">Aceite os termos para continuar</small>}
        </>
      }
      foot={
        <>
          <small>Você continua no app depois</small>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn out" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? <i className="lvf-sp" /> : <I n="check" cls="sm" />}
            {mutation.isPending ? "Enviando…" : "Aceitar convite"}
          </button>
        </>
      }
    />
  );
}
