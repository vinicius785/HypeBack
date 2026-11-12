import type { CSSProperties } from "react";

import { AdminAvatar, AdminLink, type AdminLinkTarget } from "@/components/admin/platform";

import "@/styles/admin-dashboard.css";

export interface CarouselPerson {
  id: string | number;
  name: string;
  photo: string | null;
  to?: AdminLinkTarget;
}

interface Props {
  /** Nome da faixa para leitor de tela ("Clientes recentes"). */
  label: string;
  people: readonly CarouselPerson[];
  /** Sem ninguém (carregando), a faixa mostra círculos de esqueleto do mesmo tamanho. */
  loading?: boolean;
}

/** Quantas pessoas a faixa precisa para dar a volta sem buraco: abaixo disso a lista é repetida até chegar. */
const MIN_TRACK = 10;
/** Largura de um rosto mais o vão (px) e a velocidade da faixa (px por segundo): o mesmo ritmo em toda faixa. */
const FACE_STEP_PX = 64;
const SPEED_PX_PER_S = 36;

/**
 * Carrossel infinito e automático de fotos (clientes ou criadores): uma faixa que anda sozinha para a esquerda, devagar e sem
 * parar, e volta ao começo sem salto (a lista vem duas vezes na faixa e a animação anda exatamente uma lista). Passar o mouse
 * ou focar um rosto PAUSA; cada rosto leva ao detalhe (nome no `title`). Para quem pediu menos movimento, a faixa fica parada
 * e rola com o dedo/mouse. A cópia repetida é só visual (`aria-hidden`): o leitor de tela lê a lista uma vez.
 */
export function DashboardCarousel({ label, people, loading }: Props) {
  if (loading || people.length === 0) {
    return (
      <div className="adm-dash-car" aria-hidden={loading ? "true" : undefined} data-empty="true">
        <div className="adm-dash-car-track" data-still="true">
          <div className="adm-dash-car-half">
            {Array.from({ length: MIN_TRACK }, (_, i) => (
              <span key={i} className="adm-dash-car-face" data-skeleton={loading ? "true" : undefined} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  // Repete a lista até ter rostos suficientes para a faixa não ficar com buraco, e então a duplica para o laço.
  const copies = Math.max(1, Math.ceil(MIN_TRACK / people.length));
  const base = Array.from({ length: copies }, () => people).flat();
  const face = (person: CarouselPerson, key: string, hidden: boolean) => {
    const avatar = <AdminAvatar name={person.name} photo={person.photo} size={44} />;
    return person.to && !hidden ? (
      <AdminLink key={key} to={person.to} className="adm-dash-car-face" title={person.name}>
        {avatar}
      </AdminLink>
    ) : (
      <span key={key} className="adm-dash-car-face" title={person.name}>
        {avatar}
      </span>
    );
  };
  // Mesma velocidade em todas as faixas (a duração acompanha o tamanho da lista) e mesma fase (o atraso negativo parte do relógio
  // da página): clientes e criadores andam juntos, no mesmo ritmo, em vez de cada uma partir de um ponto quando seus dados chegam.
  const seconds = Math.max(24, Math.round((base.length * FACE_STEP_PX) / SPEED_PX_PER_S));
  const track = { animationDuration: `${seconds}s`, animationDelay: `-${(Date.now() / 1000) % seconds}s` } as CSSProperties;
  return (
    <div className="adm-dash-car" role="group" aria-label={label}>
      <div className="adm-dash-car-track" style={track}>
        <div className="adm-dash-car-half">{base.map((person, i) => face(person, `a${i}-${person.id}`, false))}</div>
        {/* a segunda volta é só visual (o laço sem salto); fora do foco e do leitor de tela */}
        <div className="adm-dash-car-half" aria-hidden="true">
          {base.map((person, i) => face(person, `b${i}-${person.id}`, true))}
        </div>
      </div>
    </div>
  );
}
