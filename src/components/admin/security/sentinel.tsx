import sentinelaImage from "@/assets/images/sentinela.png";

import "@/styles/admin-security.css";

/**
 * A sentinela da tela de Segurança: a personagem da Hype de binóculos, dentro da "ilha" (que é mais alta que as outras para
 * abrigá-la). A imagem fica inteira; a vida vem de pequenos movimentos de quem observa:
 *
 *  - o corpo respira e gira devagar de um lado a outro, procurando;
 *  - os binóculos (uma camada própria, a mesma imagem recortada) "focam": avançam um pouco para o rosto, voltam e se ajustam;
 *  - um brilho corre pelas lentes, o halo delas pulsa e uma faísca pisca de vez em quando;
 *  - o brinco balança.
 *
 * Com alertas novos (`alert`) ela viu algo: inclina-se para a frente, os binóculos sobem num salto, as lentes ficam vermelhas
 * com anéis que se abrem e um "!" pula sobre a cabeça.
 *
 * É decorativa (`aria-hidden`, não recebe clique): o estado em palavras está no número da ilha. Sem movimento com
 * `prefers-reduced-motion`; em tela estreita ela não aparece.
 */
export function Sentinel({ alert = false }: { alert?: boolean }) {
  return (
    <span className="adm-sentinel" data-state={alert ? "alert" : "calm"} aria-hidden="true">
      {/* espelhada: à direita da ilha ela olha para o conteúdo, à esquerda */}
      <span className="adm-sentinel-flip">
      <span className="adm-sentinel-spot" />
      <i className="adm-sentinel-mote" data-n="1" />
      <i className="adm-sentinel-mote" data-n="2" />
      <i className="adm-sentinel-mote" data-n="3" />
      <i className="adm-sentinel-mote" data-n="4" />
      <span className="adm-sentinel-floor" />
      <span className="adm-sentinel-body">
        <img className="adm-sentinel-base" src={sentinelaImage} alt="" draggable={false} />
        <span className="adm-sentinel-hoop">
          <img src={sentinelaImage} alt="" draggable={false} />
        </span>
        <span className="adm-sentinel-optics">
          <img src={sentinelaImage} alt="" draggable={false} />
          <span className="adm-sentinel-lens" data-lens="l">
            <i />
          </span>
          <span className="adm-sentinel-lens" data-lens="r">
            <i />
          </span>
          <span className="adm-sentinel-spark" data-lens="l" />
          <span className="adm-sentinel-spark" data-lens="r" />
          <span className="adm-sentinel-ring" data-lens="l" />
          <span className="adm-sentinel-ring" data-lens="r" />
        </span>
      </span>
      </span>
      <b className="adm-sentinel-bang">!</b>
    </span>
  );
}
