import React from "react";
import { metrics, number, dateLabel } from "../display.js";
export default function WeeklyView({ weekly, onDay }) {
  const max = Math.max(1, ...weekly.daily.map((d) => d.totals.calories)),
    recorded = weekly.daily.filter((d) => d.meal_count > 0).length;
  return (
    <>
      <section className="panel weekly">
        <div className="section-title">
          <div>
            <p className="eyebrow">ΔΕΥΤΕΡΑ – ΚΥΡΙΑΚΗ</p>
            <h2>Η εβδομάδα σε αριθμούς</h2>
          </div>
          <span className="badge">{recorded}/7 ημέρες με καταγραφές</span>
        </div>
        <div className="weekly-grid">
          {metrics.map(([key, label, unit]) => (
            <article key={key} className="week-metric">
              <h3>{label}</h3>
              <strong>
                {number(weekly.totals[key])}
                <small> {unit}</small>
              </strong>
              <p>
                Μ.Ο.{" "}
                <b>
                  {number(weekly.daily_average[key])} {unit}
                </b>{" "}
                / ημέρα
              </p>
            </article>
          ))}
        </div>
        {weekly.incomplete_macro_records > 0 && (
          <p className="data-note">
            Υπάρχουν γεύματα με άγνωστα macros· τα αντίστοιχα σύνολα είναι
            ελλιπή.
          </p>
        )}
      </section>
      <section className="panel weekly-chart">
        <h2>Θερμίδες ανά ημέρα</h2>
        <p className="muted">Πάτησε μια ημέρα για να δεις τα γεύματά της.</p>
        <div
          className="week-bars"
          role="group"
          aria-label="Καταγεγραμμένες θερμίδες εβδομάδας"
        >
          {weekly.daily.map((d) => (
            <button
              className="day-bar"
              key={d.date}
              onClick={() => onDay(d.date)}
              aria-label={`${dateLabel(d.date, { weekday: "long", day: "numeric", month: "long" })}: ${number(d.totals.calories)} kcal, ${d.meal_count} γεύματα`}
            >
              <span className="bar-value">
                {d.meal_count ? number(d.totals.calories) : "—"}
              </span>
              <span className="bar-track">
                <span
                  style={{
                    height: `${Math.max(2, (d.totals.calories / max) * 100)}%`,
                  }}
                  className={d.meal_count ? "" : "unlogged"}
                />
              </span>
              <b>{dateLabel(d.date, { weekday: "short" })}</b>
              <small>
                {dateLabel(d.date, { day: "numeric", month: "numeric" })}
              </small>
            </button>
          ))}
        </div>
        <p className="data-note">
          Ο μέσος όρος υπολογίζεται σε 7 ημέρες. Μια ημέρα χωρίς καταγραφή δεν
          σημαίνει μηδενική πρόσληψη.
        </p>
      </section>
      <section className="panel week-fueling">
        <h2>Τροφοδοσία προπόνησης</h2>
        <dl className="nutrition-list">
          {metrics.map(([key, label, unit]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                {number(weekly.workout_fueling[key])} {unit}
              </dd>
            </div>
          ))}
        </dl>
        <p className="data-note">
          Περιλαμβάνεται ήδη στα σύνολα της εβδομάδας.
        </p>
      </section>
    </>
  );
}
