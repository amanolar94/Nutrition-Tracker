import React from "react";
import { localDate } from "../nutrition.js";
import { dateLabel, relativeDay, shiftDate } from "../display.js";
import { weekBounds } from "../summaries.js";
import Icon from "./Icons.jsx";
import DateInput from "./DateInput.jsx";
export default function DateBar({ date, onChange, weekly = false }) {
  const today = localDate(),
    week = weekBounds(date),
    current = weekly
      ? week.start_date === weekBounds(today).start_date
      : date === today;
  return (
    <section
      className="date-bar"
      aria-label={weekly ? "Επιλογή εβδομάδας" : "Επιλογή ημέρας"}
    >
      <button
        className="icon-button"
        aria-label={weekly ? "Προηγούμενη εβδομάδα" : "Προηγούμενη ημέρα"}
        onClick={() => onChange(shiftDate(date, weekly ? -7 : -1))}
      >
        <Icon name="left" />
      </button>
      <label className="calendar-picker">
        <span className="date-caption">
          <strong>
            {weekly
              ? `${dateLabel(week.start_date, { day: "numeric", month: "short" })} – ${dateLabel(week.end_date, { day: "numeric", month: "short" })}`
              : relativeDay(date, today)}
          </strong>
          <span>
            {weekly
              ? week.start_date.slice(0, 4) === week.end_date.slice(0, 4)
                ? week.end_date.slice(0, 4)
                : `${week.start_date.slice(0, 4)}–${week.end_date.slice(0, 4)}`
              : dateLabel(date, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
          </span>
        </span>
        <Icon name="week" />
        <DateInput
          aria-label="Ημερομηνία καταγραφής"
          value={date}
          required
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </label>
      <button
        className="icon-button"
        aria-label={weekly ? "Επόμενη εβδομάδα" : "Επόμενη ημέρα"}
        onClick={() => onChange(shiftDate(date, weekly ? 7 : 1))}
      >
        <Icon name="right" />
      </button>
      {!current && (
        <button className="today-button" onClick={() => onChange(today)}>
          {weekly ? "Τρέχουσα εβδομάδα" : "Σήμερα"}
        </button>
      )}
    </section>
  );
}
