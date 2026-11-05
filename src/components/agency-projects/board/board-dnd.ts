import { closestCorners, pointerWithin, type CollisionDetection, type KeyboardCoordinateGetter } from "@dnd-kit/core";

import { COLUMN_ID_PREFIX, neighborColumn, type ColumnBox } from "./task-logic";

/**
 * Soltar com o mouse ou o dedo: vale a coluna que está sob o ponteiro (não a que tem os cantos do cartão mais perto, que
 * errava para a coluna do lado quando o cartão é largo). Sem ponteiro (teclado) ou fora de qualquer coluna, cai no
 * critério dos cantos.
 */
export const boardCollisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCorners(args);
};

/** Folga entre o canto da coluna e o cartão solto (para ficar claramente dentro dela). */
const INSET = 12;

/**
 * Teclado no quadro: seta para a direita/esquerda leva o cartão pego para a coluna seguinte/anterior (o padrão do dnd-kit
 * anda 25px por tecla, o que não serve para trocar de coluna). Nas pontas não faz nada; outras teclas (Espaço, Enter,
 * Esc) seguem com o sensor.
 */
export const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context: { active, collisionRect, droppableRects, droppableContainers } }) => {
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return undefined;
  event.preventDefault();
  if (!active || !collisionRect) return undefined;

  const boxes: ColumnBox[] = [];
  for (const container of droppableContainers.getEnabled()) {
    const rect = droppableRects.get(container.id);
    if (rect && String(container.id).startsWith(COLUMN_ID_PREFIX)) boxes.push({ id: String(container.id), left: rect.left, top: rect.top, width: rect.width });
  }
  const target = neighborColumn(boxes, collisionRect.left + collisionRect.width / 2, event.code === "ArrowRight" ? 1 : -1);
  return target ? { x: target.left + INSET, y: target.top + INSET } : undefined;
};
