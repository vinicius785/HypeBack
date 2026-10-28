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
  postPublicCampaignInviteDecline,
  type PublicCampaignInviteData,
} from "@/shared/services/public-campaign-invite";
import { formatBrazilianPhoneInput } from "@/shared/utils/masks";

const REASONS = [
  "Sem tempo neste período",
  "O nicho não combina comigo",
  "Valor abaixo do esperado",
  "Já tenho outra campanha",
  "Outro motivo",
];
const OTHER = REASONS.length - 1;

interface CampaignInviteDeclineModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignPublicId: string;
  inviteData: PublicCampaignInviteData;
  onDeclineRecorded: () => void;
}

export function CampaignInviteDeclineModal(props: CampaignInviteDeclineModalProps) {
  if (!props.isOpen) return null;
  return <DeclineContent {...props} />;
}

function DeclineContent({
  onClose,
  campaignPublicId,
  inviteData,
  onDeclineRecorded,
}: CampaignInviteDeclineModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState(-1);
  const [detail, setDetail] = useState("");
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState(false);

  const other = reason === OTHER;
  // A API exige texto livre (mín. 5 caracteres): o motivo escolhido entra no texto.
  const text = [reason >= 0 && !other ? REASONS[reason] : "", detail.trim()]
    .filter(Boolean)
    .join(". ");
  const detailBad = tried && other && detail.trim().length < 5;

  const mutation = useMutation({
    mutationFn: () =>
      postPublicCampaignInviteDecline(campaignPublicId, {
        name: name.trim(),
        email: email.trim(),
        phone,
        decline_reason: text,
      }),
    onSuccess: () => {
      onDeclineRecorded();
      setDone(true);
      toast.success("Recusa registrada");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao enviar. Tente novamente.");
    },
  });

  const submit = () => {
    if (
      reason < 0 ||
      text.length < 5 ||
      (other && detail.trim().length < 5) ||
      name.trim().length < 2 ||
      !isEmail(email) ||
      !isPhone(phone)
    ) {
      setTried(true);
      return;
    }
    mutation.mutate();
  };

  if (done) {
    return (
      <InviteModalShell
        title="Recusa enviada"
        sub="Obrigado"
        onClose={onClose}
        body={
          <div className="cvm-ok dn">
            <span>
              <I n="check" />
            </span>
            <h3>Recusa enviada</h3>
            <p>
              Obrigado por avisar. A marca recebeu a sua resposta. Se mudar de ideia, peça um novo
              convite à marca.
            </p>
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

  return (
    <InviteModalShell
      title="Recusar convite"
      sub="Que pena"
      onClose={onClose}
      body={
        <>
          <InviteSummary data={inviteData} />

          <div className={`cvm-sc${tried && reason < 0 ? " bad" : ""}`}>
            <h4>Por que você não vai participar?</h4>
            <div className="cvm-rs">
              {REASONS.map((r, i) => (
                <button
                  key={r}
                  type="button"
                  className={reason === i ? "on" : ""}
                  onClick={() => setReason(i)}
                >
                  {reason === i && <I n="check" cls="sm" />}
                  {r}
                </button>
              ))}
            </div>
            {tried && reason < 0 && <small className="cvm-er">Escolha um motivo</small>}
            <div className={`cvm-fd${detailBad ? " bad" : ""}`}>
              <label htmlFor="cvr">
                {other ? (
                  "Conte o motivo"
                ) : (
                  <>
                    Quer contar mais? <em>opcional</em>
                  </>
                )}
              </label>
              <textarea
                id="cvr"
                rows={3}
                maxLength={400}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Ex.: não tenho tempo neste período, o nicho não combina com meu perfil…"
              />
              {detailBad && <small>Escreva pelo menos algumas palavras</small>}
            </div>
          </div>

          <div className="cvm-sc cvm-yo">
            <h4>Seus dados</h4>
            <InviteField
              id="cvn"
              label="Nome completo"
              value={name}
              onChange={setName}
              placeholder="Como você se chama"
              error={tried && name.trim().length < 2 ? "Informe seu nome" : ""}
              autoComplete="name"
            />
            <InviteField
              id="cve"
              label="E-mail"
              value={email}
              onChange={setEmail}
              placeholder="voce@email.com"
              error={tried && !isEmail(email) ? "Digite um e-mail válido" : ""}
              type="email"
              autoComplete="email"
            />
            <InviteField
              id="cvp"
              label="Celular com DDD"
              value={phone}
              onChange={(v) => setPhone(formatBrazilianPhoneInput(v))}
              placeholder="(11) 99999-9999"
              error={tried && !isPhone(phone) ? "Informe o celular com DDD" : ""}
              prefix="BR +55"
              inputMode="numeric"
              type="tel"
              autoComplete="tel"
            />
          </div>
        </>
      }
      foot={
        <>
          <small>A marca é avisada da sua resposta</small>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn out" onClick={onClose}>
            Voltar
          </button>
          <button type="button" className="btn dng" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? <i className="lvf-sp" /> : null}
            {mutation.isPending ? "Enviando…" : "Enviar recusa"}
          </button>
        </>
      }
    />
  );
}
