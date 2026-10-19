import React from "react";
import { metrics, number, dateLabel } from "../display.js";
import EnergyBalance from "./EnergyBalance.jsx";
const signed = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${number(Math.abs(n))}`;
const missingLabel = (d) =>
  d.energy_balance.unavailable_reason === "future_date"
    ? "Μελλοντική ημέρα"
    : !d.meal_count
      ? "Χωρίς δεδομένα"
      : "Όρισε συντήρηση";
export default function WeeklyView({ weekly, onDay, onSettings }) {
  const max = Math.max(
    1,
    ...weekly.daily.map((d) =>
      Math.abs(d.energy_balance.balance_calories || 0),
    ),
  );
  return (
    <>
      <section className="panel weekly weekly-balances">
        <div className="section-title">
          <div>
            <p className="eyebrow">ΔΕΥΤΕΡΑ – ΚΥΡΙΑΚΗ</p>
            <h2>Το ισοζύγιο της εβδομάδας</h2>
          </div>
          <span className="badge">
            {weekly.recorded_days}/7 ημέρες με καταγραφές
          </span>
        </div>
        <EnergyBalance
          energy={weekly.energy_balance}
          weekly
          onSettings={onSettings}
          compact
        />
        <div className="balance-legend">
          <span>
            <i className="deficit-dot" />
            Έλλειμμα −
          </span>
          <span>
            <i className="surplus-dot" />
            Πλεόνασμα +
          </span>
          <span>— Χωρίς εκτίμηση</span>
        </div>
        <div
          className="week-bars balance-chart"
          role="group"
          aria-label="Εκτιμώμενο ενεργειακό ισοζύγιο εβδομάδας"
        >
          {weekly.daily.map((d) => {
            const balance = d.energy_balance.balance_calories;
            const label =
              balance === null ? missingLabel(d) : `${signed(balance)} kcal`;
            return (
              <button
                className={`day-bar ${balance === null ? "unavailable" : balance < 0 ? "deficit" : "surplus"}`}
                key={d.date}
                onClick={() => onDay(d.date)}
                aria-label={`${dateLabel(d.date, { weekday: "long", day: "numeric", month: "long" })}: ${d.meal_count ? number(d.totals.calories) + " kcal πρόσληψη" : "Χωρίς δεδομένα"}, ${label}`}
              >
                <span className="bar-value">
                  {balance === null ? "—" : signed(balance)}
                </span>
                <span className="balance-track" aria-hidden="true">
                  <span className="zero-line" />
                  {balance !== null && (
                    <span
                      className="balance-bar"
                      style={{
                        height: `${Math.max(2, (Math.abs(balance) / max) * 48)}%`,
                        ...(balance < 0 ? { top: "50%" } : { bottom: "50%" }),
                      }}
                    />
                  )}
                </span>
                <b>{dateLabel(d.date, { weekday: "short" })}</b>
                <small>
                  {dateLabel(d.date, { day: "numeric", month: "numeric" })}
                </small>
              </button>
            );
          })}
        </div>
        <p className="data-note">
          Εκτίμηση από τις καταγραφές σου. Οι ημέρες χωρίς γεύματα και οι
          μελλοντικές ημέρες εξαιρούνται από το ισοζύγιο.
        </p>
        <details className="week-details">
          <summary>Ανάλυση ανά ημέρα</summary>
          <ul>
            {weekly.daily.map((d) => (
              <li key={d.date}>
                <button className="balance-day" onClick={() => onDay(d.date)}>
                  <span>
                    <b>
                      {dateLabel(d.date, {
                        weekday: "short",
                        day: "numeric",
                        month: "numeric",
                      })}{" "}
                      · {d.day_type === "training" ? "Προπόνηση" : "Ανάπαυση"}
                    </b>
                    <small>
                      Φαγητό {d.meal_count ? number(d.totals.calories) : "—"} ·
                      Προπόνηση {number(d.energy_balance.workout_calories)} kcal
                    </small>
                  </span>
                  <strong>
                    {d.energy_balance.balance_calories === null
                      ? missingLabel(d)
                      : `${signed(d.energy_balance.balance_calories)} kcal`}
                  </strong>
                </button>
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section className="panel weekly-nutrition">
        <h2>Η διατροφή σε αριθμούς</h2>
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
                  {weekly.recorded_day_average[key] === null
                    ? "—"
                    : number(weekly.recorded_day_average[key])}{" "}
                  {unit}
                </b>{" "}
                / ημέρα με καταγραφές
              </p>
            </article>
          ))}
        </div>
        <p className="data-note">
          Μέσος όρος στις {weekly.recorded_days} ημέρες με γεύματα. Οι ελλιπείς
          ημερήσιες καταγραφές επηρεάζουν τον μέσο όρο.
        </p>
        {weekly.incomplete_macro_records > 0 && (
          <p className="data-note">
            Υπάρχουν γεύματα με άγνωστα macros· τα σύνολα είναι ελλιπή.
          </p>
        )}
        <details className="week-details">
          <summary>
            Workout fueling · {number(weekly.workout_fueling.calories)} kcal
          </summary>
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
        </details>
      </section>
    </>
  );
}
