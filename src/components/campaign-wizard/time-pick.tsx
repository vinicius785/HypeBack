import { useEffect, useRef, useState, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";

const p2 = (n: number) => String(n).padStart(2, "0");

/** Fecha o popover ao clicar fora do elemento referenciado. */
export function useOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) cb.current();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return ref;
}


/* ───────────────────────── relógio ───────────────────────── */

const DL = { C: 88, Ro: 72, Ri: 46, B: 26 };

/**
 * Miolo do relógio: digita hora e minuto ou escolhe no mostrador (primeiro a hora, depois os minutos). Vale qualquer
 * horário, de 00:00 a 23:59; `value` vazio = sem horário. Usado no popover da campanha (`TimePick`) e em linha (`TimeClock`).
 */
function TimeDial({ value, onChange, footer }: { value: string; onChange: (v: string) => void; footer?: ReactNode }) {
  const [mode, setMode] = useState<"h" | "m">("h");
  const [draft, setDraft] = useState<{ h?: string; m?: string }>({});
  const angRef = useRef<number | null>(null);

  const [hh = "", mm = ""] = (value || "").split(":");

  const setPart = (part: "h" | "m", v: string) => {
    const h = part === "h" ? v : hh;
    const m = part === "m" ? v : mm;
    onChange(h || m ? `${h || "00"}:${m || "00"}` : "");
  };

  const { C, Ro, Ri, B } = DL;
  const pos = (idx: number, R: number): [number, number] => {
    const a = ((idx * 30 - 90) * Math.PI) / 180;
    return [C + R * Math.cos(a) - B / 2, C + R * Math.sin(a) - B / 2];
  };

  const val = mode === "h" ? hh : mm;
  let hand: ReactNode = null;
  if (val) {
    const target = mode === "h" ? (+hh % 12) * 30 : +mm * 6;
    const R = mode === "h" ? (+hh < 12 ? Ro : Ri) : Ro;
    const cur = angRef.current ?? target;
    const d = ((target - cur + 540) % 360) - 180;
    angRef.current = cur + d;
    hand = <i className="dl-h grow" style={{ height: R, transform: `rotate(${cur + d}deg)` }} />;
  } else {
    angRef.current = null;
  }

  const onInput = (part: "h" | "m", raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setDraft((d) => ({ ...d, [part]: digits }));
    if (digits.length === 2) {
      const max = part === "h" ? 23 : 59;
      const v = p2(Math.min(+digits, max));
      setPart(part, v);
      setDraft((d) => ({ ...d, [part]: undefined }));
      if (part === "h") setMode("m");
    }
  };
  const onBlur = (part: "h" | "m") => {
    const t = draft[part];
    if (t) setPart(part, p2(Math.min(+t, part === "h" ? 23 : 59)));
    setDraft((d) => ({ ...d, [part]: undefined }));
  };

  const dial: ReactNode[] = [];
  if (mode === "h") {
    for (let h = 0; h < 24; h++) {
      const [x, y] = pos(h % 12, h < 12 ? Ro : Ri);
      dial.push(
        <button
          key={h}
          type="button"
          className={`dl-n ${h >= 12 ? "in" : ""} ${hh === p2(h) ? "sel" : ""}`}
          style={{ left: x, top: y, ["--k" as string]: h % 12 }}
          onClick={() => {
            setPart("h", p2(h));
            setMode("m");
          }}
        >
          {p2(h)}
        </button>,
      );
    }
  } else {
    for (let k = 0; k < 12; k++) {
      const [x, y] = pos(k, Ro);
      dial.push(
        <button
          key={k}
          type="button"
          className={`dl-n ${mm === p2(k * 5) ? "sel" : ""}`}
          style={{ left: x, top: y, ["--k" as string]: k }}
          onClick={() => setPart("m", p2(k * 5))}
        >
          {p2(k * 5)}
        </button>,
      );
    }
  }

  return (
    <>
      <div className="tim-d">
        <input
          className={`tin ${mode === "h" ? "on" : ""}`}
          inputMode="numeric"
          maxLength={2}
          placeholder="--"
          aria-label="Hora"
          autoComplete="off"
          value={draft.h ?? hh}
          onFocus={() => setMode("h")}
          onChange={(e) => onInput("h", e.target.value)}
          onBlur={() => onBlur("h")}
        />
        <span>:</span>
        <input
          className={`tin ${mode === "m" ? "on" : ""}`}
          inputMode="numeric"
          maxLength={2}
          placeholder="--"
          aria-label="Minutos"
          autoComplete="off"
          value={draft.m ?? mm}
          onFocus={() => setMode("m")}
          onChange={(e) => onInput("m", e.target.value)}
          onBlur={() => onBlur("m")}
        />
      </div>
      <div className="dl swap" key={mode}>
        {hand}
        <i className="dl-c" />
        {dial}
      </div>
      {footer}
    </>
  );
}

/** Campo com botão que abre o relógio num popover (etapa Fases da campanha). */
export function TimePick({
  value,
  onChange,
  label = "Horário",
  placeholder = "Escolher hora",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div ref={ref} className="n4c pkw">
      <label className="n4l">{label}</label>
      <button type="button" className={`n4pk ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <span className={value ? "" : "ph"}>{value || placeholder}</span>
        <I n="clock" cls="sm" />
      </button>
      {open ? (
        <div className="pkp tim pop">
          <TimeDial
            value={value}
            onChange={onChange}
            footer={
              <div className="cal-f">
                <button type="button" onClick={() => onChange("")}>
                  Limpar
                </button>
                <button type="button" onClick={() => setOpen(false)}>
                  Pronto
                </button>
              </div>
            }
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * O mesmo relógio, já aberto e dentro do próprio quadro (sem botão nem popover): para lugares com `overflow: hidden`,
 * como o agendamento de notificações, onde um popover seria cortado.
 */
export function TimeClock({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="tim-inline" role="group" aria-label="Horário">
      <TimeDial value={value} onChange={onChange} />
    </div>
  );
}
