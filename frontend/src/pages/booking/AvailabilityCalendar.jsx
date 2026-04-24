import { useState } from "react";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

function toStr(date) {
  return date.toISOString().split("T")[0];
}

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function AvailabilityCalendar({ blockedDates = [], checkIn, checkOut, onChange }) {
  const now = today();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [phase, setPhase] = useState("checkin"); // "checkin" | "checkout"

  const blockedSet = new Set(blockedDates);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function hasBlockedInRange(from, to) {
    const cur = new Date(from);
    cur.setDate(cur.getDate() + 1);
    while (toStr(cur) < to) {
      if (blockedSet.has(toStr(cur))) return true;
      cur.setDate(cur.getDate() + 1);
    }
    return false;
  }

  function handleClick(dateStr) {
    const date = new Date(dateStr);
    if (date < now || blockedSet.has(dateStr)) return;

    if (phase === "checkin" || !checkIn) {
      onChange(dateStr, null);
      setPhase("checkout");
      return;
    }

    if (dateStr <= checkIn) {
      onChange(dateStr, null);
      setPhase("checkout");
      return;
    }

    if (hasBlockedInRange(checkIn, dateStr)) {
      onChange(dateStr, null);
      setPhase("checkout");
      return;
    }

    onChange(checkIn, dateStr);
    setPhase("checkin");
  }

  function dayClass(dateStr) {
    const date = new Date(dateStr);
    if (date < now) return "cal-day cal-day--past";
    if (blockedSet.has(dateStr)) return "cal-day cal-day--blocked";
    if (dateStr === checkIn) return "cal-day cal-day--checkin";
    if (dateStr === checkOut) return "cal-day cal-day--checkout";
    if (checkIn && checkOut && dateStr > checkIn && dateStr < checkOut)
      return "cal-day cal-day--range";
    return "cal-day cal-day--available";
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const rawFirstDay = new Date(viewYear, viewMonth, 1).getDay();
  const firstDay = rawFirstDay === 0 ? 6 : rawFirstDay - 1;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }

  const isPrevDisabled =
    viewYear === now.getFullYear() && viewMonth === now.getMonth();

  return (
    <div className="cal-wrapper">
      <div className="cal-header">
        <button
          className="cal-nav"
          type="button"
          onClick={prevMonth}
          disabled={isPrevDisabled}
        >
          ‹
        </button>
        <span className="cal-title">{MONTHS[viewMonth]} {viewYear}</span>
        <button className="cal-nav" type="button" onClick={nextMonth}>›</button>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map(d => (
          <div key={d} className="cal-weekday">{d}</div>
        ))}
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`e${i}`} className="cal-day cal-day--empty" />;
          const day = parseInt(dateStr.split("-")[2]);
          const date = new Date(dateStr);
          const disabled = date < now || blockedSet.has(dateStr);
          return (
            <button
              key={dateStr}
              type="button"
              className={dayClass(dateStr)}
              onClick={() => handleClick(dateStr)}
              disabled={disabled}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="cal-hint">
        {!checkIn && "Sélectionnez votre date d'arrivée"}
        {checkIn && !checkOut && "Sélectionnez votre date de départ"}
        {checkIn && checkOut && (
          <span className="cal-hint--selected">
            {new Date(checkIn).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            {" → "}
            {new Date(checkOut).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>

      <div className="cal-legend">
        <span className="cal-legend-item">
          <span className="cal-legend-dot cal-legend-dot--available" />
          Disponible
        </span>
        <span className="cal-legend-item">
          <span className="cal-legend-dot cal-legend-dot--blocked" />
          Indisponible
        </span>
        <span className="cal-legend-item">
          <span className="cal-legend-dot cal-legend-dot--selected" />
          Sélectionné
        </span>
      </div>
    </div>
  );
}
