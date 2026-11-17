import { getUploadUrl } from "@/lib/utils/api";
import { type PopupDraft } from "@/lib/admin/popup-form";

import { PopupIcon } from "./popup-icon";

/** O pop-up como o app o mostra: cartão centralizado sobre o app escurecido. Muda na hora com o que se escreve. */
export function PopupPreview({ draft }: { draft: PopupDraft }) {
  const image = draft.imageUrl ? (draft.imageUrl.startsWith("/") ? getUploadUrl(draft.imageUrl) : draft.imageUrl) : undefined;
  const showButton = !!draft.buttonLabel.trim() && !!draft.screen;
  return (
    <figure className="adm-pop-pv" aria-label="Prévia do pop-up">
      <div className="adm-pop-stage">
        <span className="adm-pop-ghost" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <div className="adm-pop-card" data-theme={draft.theme}>
          {image ? (
            <img className="adm-pop-img" src={image} alt="" />
          ) : draft.icon ? (
            <span className="adm-pop-ic">
              <PopupIcon name={draft.icon} size={26} />
            </span>
          ) : null}
          <b>{draft.title.trim() || "Título do pop-up"}</b>
          {draft.body.trim() ? <p>{draft.body}</p> : null}
          {showButton ? <span className="adm-pop-btn">{draft.buttonLabel.trim()}</span> : null}
          <span className="adm-pop-x">Fechar</span>
        </div>
      </div>
      <figcaption>Prévia: assim o app mostra ao abrir.</figcaption>
    </figure>
  );
}
