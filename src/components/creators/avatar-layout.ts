export interface AvatarPoint {
  id: string | number;
  /** Posição no plano de pixels do mapa (no zoom atual). */
  x: number;
  y: number;
}

/** Ângulo áureo: os candidatos giram em espiral sem repetir direção. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Teto de tentativas por avatar (só uma aglomeração absurda chega perto). */
const MAX_TRIES = 6000;

/**
 * Posiciona avatares sem sobreposição: cada um fica no próprio ponto e, se esbarrar
 * em outro já posicionado, vai para o lugar livre mais próximo (espiral ao redor do
 * ponto). Quem chega primeiro não se mexe, então a ordem de entrada é a prioridade e
 * novos itens nunca empurram os que já estavam no mapa.
 *
 * Pontos idênticos (criadores na mesma célula de ~1 km) formam um aglomerado em torno
 * dele, que é o único jeito de mostrar todos mesmo sem dar para separar no mapa.
 *
 * @param minDist distância mínima (px) entre os centros de dois avatares.
 * @returns as posições finais, na mesma ordem de `points`.
 */
export function spreadAvatars(points: AvatarPoint[], minDist: number): AvatarPoint[] {
  const grid = new Map<string, AvatarPoint[]>();
  const cellOf = (v: number) => Math.floor(v / minDist);
  const min2 = minDist * minDist;

  /** Livre = nenhum avatar posicionado a menos de `minDist` (basta olhar as 9 células vizinhas). */
  const isFree = (x: number, y: number) => {
    const cx = cellOf(x);
    const cy = cellOf(y);
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cy - 1; j <= cy + 1; j++) {
        for (const p of grid.get(`${i}:${j}`) ?? []) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy < min2) return false;
        }
      }
    }
    return true;
  };

  const step = minDist * 0.45;
  return points.map((pt) => {
    let x = pt.x;
    let y = pt.y;
    for (let k = 1; k <= MAX_TRIES && !isFree(x, y); k++) {
      const r = step * Math.sqrt(k);
      x = pt.x + r * Math.cos(k * GOLDEN_ANGLE);
      y = pt.y + r * Math.sin(k * GOLDEN_ANGLE);
    }
    const placed = { id: pt.id, x, y };
    const key = `${cellOf(x)}:${cellOf(y)}`;
    const cell = grid.get(key);
    if (cell) cell.push(placed);
    else grid.set(key, [placed]);
    return placed;
  });
}
