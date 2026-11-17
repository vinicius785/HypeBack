import { useState } from "react";

import { I } from "@/components/prototype/ui";
import { TimeClock } from "@/components/campaign-wizard/time-pick";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WD = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const pad = (n: number) => String(n).padStart(2, "0");

interface Props {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`. */
  time: string;
  onDate: (date: string) => void;
  onTime: (time: string) => void;
  /** Primeiro dia que pode ser escolhido (`YYYY-MM-DD`); antes dele os dias ficam desabilitados. */
  minDate: string;
}

/** Calendário e relógio do agendamento: o mesmo desenho do "Agendar para depois" das notificações. */
export function SchedulePicker({ date, time, onDate, onTime, minDate }: Props) {
  const start = new Date(`${date}T12:00:00`);
  const [cal, setCal] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const { y, m } = cal;
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const nav = (delta: number) => {
    const next = new Date(y, m + delta, 1);
    setCal({ y: next.getFullYear(), m: next.getMonth() });
  };

  return (
    <div className="lvq">
      <div className="lvq-l">
        <div className="lvf-cal">
          <div className="cal-h">
            <button type="button" onClick={() => nav(-1)} aria-label="Mês anterior">
              <I n="chev" cls="sm" />
            </button>
            <b>
              {MESES[m]} {y}
            </b>
            <button type="button" onClick={() => nav(1)} aria-label="Próximo mês">
              <I n="chev" cls="sm" />
            </button>
          </div>
          <div className="cal-w">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((letter, index) => (
              <span key={index}>{letter}</span>
            ))}
          </div>
          <div className="cal-g">
            {Array.from({ length: first }, (_, index) => (
              <i key={`e${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const value = `${y}-${pad(m + 1)}-${pad(index + 1)}`;
              return (
                <button key={value} type="button" className={`cal-d ${value === date ? "sel" : ""} ${value === minDate ? "today" : ""}`} disabled={value < minDate} onClick={() => onDate(value)}>
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="lvq-r">
        <div className="lvq-h">
          <b>
            {WD[start.getDay()]}, {start.getDate()} de {MESES[start.getMonth()].toLowerCase()}
          </b>
          <small>Escolha o horário (Brasília)</small>
        </div>
        <TimeClock value={time} onChange={onTime} />
      </div>
    </div>
  );
}
