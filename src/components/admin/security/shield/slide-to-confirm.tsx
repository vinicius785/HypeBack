import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { I } from "@/components/prototype/ui";

import "@/styles/admin-security.css";

/** Quanto do trilho a pessoa precisa percorrer para valer (a partir daqui, soltar confirma). */
const THRESHOLD = 0.85;
const THUMB = 44;
const PAD = 4;

/**
 * Botão de "arrastar para confirmar": a pessoa segura o círculo e o leva até o fim do trilho (para a direita). Soltar antes do
 * fim faz ele voltar. Ao chegar, chama `onConfirm` (aqui, abre a janela do Escudo: nada acontece só com o gesto) e volta ao início.
 *
 * Teclado e leitor de tela: o círculo é um botão com o nome da ação; Enter, Espaço ou seta para a direita confirmam (o gesto de
 * arrastar é a forma "de dedo", não a única).
 */
export function SlideToConfirm({
  label,
  hint,
  onConfirm,
  disabled,
}: {
  /** Nome da ação ("Ativar Operação Escudo"): é o nome acessível do botão. */
  label: string;
  /** Texto dentro do trilho ("Deslize para ativar"). */
  hint: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; from: number } | null>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef<number | null>(null);

  const max = useCallback(() => Math.max(0, (track.current?.clientWidth ?? 0) - THUMB - PAD * 2), []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const complete = useCallback(() => {
    if (disabled || done) return;
    setDone(true);
    setX(max());
    onConfirm();
    // Volta ao início depois do gesto (a janela do Escudo já está aberta por cima).
    timer.current = window.setTimeout(() => {
      setDone(false);
      setX(0);
    }, 700);
  }, [disabled, done, max, onConfirm]);

  const onDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || done) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { startX: event.clientX, from: x };
    setDragging(true);
  };
  const onMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    setX(Math.min(max(), Math.max(0, drag.current.from + event.clientX - drag.current.startX)));
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    const limit = max();
    if (limit > 0 && x >= limit * THRESHOLD) complete();
    else setX(0);
  };
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowRight") {
      event.preventDefault();
      complete();
    }
  };

  const limit = max();
  const progress = limit > 0 ? x / limit : 0;
  return (
    <div className="adm-slide" data-dragging={dragging ? "true" : undefined} data-done={done ? "true" : undefined} data-disabled={disabled ? "true" : undefined} ref={track}>
      <span className="adm-slide-fill" style={{ width: x + THUMB + PAD }} aria-hidden="true" />
      <span className="adm-slide-label" style={{ opacity: Math.max(0, 1 - progress * 1.6) }} aria-hidden="true">
        {hint}
        <I n="chev" cls="sm" />
      </span>
      <button
        type="button"
        className="adm-slide-thumb"
        aria-label={label}
        title="Arraste para a direita (ou use Enter) para continuar"
        disabled={disabled}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <I n={done ? "check" : "shield"} cls="sm" />
      </button>
    </div>
  );
}
