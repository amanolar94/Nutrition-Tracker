import React from "react";
import { number } from "../display.js";

export default function EnergyBalance({ energy, weekly = false, onSettings }) {
  const balance = energy.balance_calories;
  const kind =
    balance === null
      ? "unknown"
      : balance < 0
        ? "deficit"
        : balance > 0
          ? "surplus"
          : "balanced";
  const label =
    balance === null
      ? "Δεν υπάρχει εκτίμηση"
      : balance < 0
        ? "Εκτιμώμενο έλλειμμα"
        : balance > 0
          ? "Εκτιμώμενο πλεόνασμα"
          : "Εκτιμώμενη ισορροπία";
  return (
    <section
      className={`panel balance-card ${kind}`}
      aria-label={
        weekly ? "Ενεργειακό ισοζύγιο εβδομάδας" : "Ενεργειακό ισοζύγιο ημέρας"
      }
    >
      <div className="section-title">
        <h2>Ενεργειακό ισοζύγιο</h2>
        {weekly && (
          <span className="badge">{energy.included_days}/7 ημέρες</span>
        )}
      </div>
      <p className="balance-label">{label}</p>
      <div className="balance-value">
        <strong>{balance === null ? "—" : number(Math.abs(balance))}</strong>
        <span>kcal</span>
      </div>
      {balance !== null && (
        <dl className="nutrition-list balance-equation">
          <div>
            <dt>Φαγητό</dt>
            <dd>{number(energy.intake_calories)} kcal</dd>
          </div>
          <div>
            <dt>Καύσεις{weekly ? " στις ημέρες σύγκρισης" : ""}</dt>
            <dd>{number(energy.estimated_expenditure_calories)} kcal</dd>
          </div>
        </dl>
      )}
      {!weekly && (
        <p className="balance-breakdown">
          Συντήρηση{" "}
          {energy.maintenance_calories === null
            ? "—"
            : number(energy.maintenance_calories)}{" "}
          + προπόνηση <b>{number(energy.workout_calories)} kcal</b>
        </p>
      )}
      {weekly && (
        <p className="data-note">
          Προπονήσεις ολόκληρης εβδομάδας:{" "}
          <b>{number(energy.workout_calories)} kcal</b>.
        </p>
      )}
      {balance === null && (
        <p className="data-note">
          {weekly
            ? "Για εκτίμηση χρειάζονται συντήρηση και γεύματα σε τουλάχιστον μία ημέρα έως σήμερα."
            : energy.unavailable_reason === "maintenance_not_set"
              ? "Όρισε τη συντήρησή σου για να δεις έλλειμμα ή πλεόνασμα."
              : energy.unavailable_reason === "future_date"
                ? "Το ισοζύγιο θα εμφανιστεί όταν φτάσει αυτή η ημέρα."
                : "Δεν υπάρχουν καταγεγραμμένα γεύματα για αυτή την ημέρα."}
        </p>
      )}
      <p className="data-note">
        {weekly ? "Μόνο ημέρες έως σήμερα με γεύματα και συντήρηση. " : ""}
        Εκτίμηση με όσα έχεις καταγράψει μέχρι τώρα.
      </p>
      <details className="balance-help">
        <summary>Πώς υπολογίζεται;</summary>
        <p>
          Φαγητό − (συντήρηση χωρίς άσκηση + ενεργές θερμίδες προπόνησης).
          Αρνητικό σημαίνει έλλειμμα, θετικό πλεόνασμα. Η τροφοδοσία προπόνησης
          περιλαμβάνεται στο φαγητό. Χρησιμοποιείται η τρέχουσα ρύθμιση
          συντήρησης για όλες τις ημερομηνίες.
        </p>
        <p>Αν λείπουν γεύματα ή προπονήσεις, το αποτέλεσμα αλλάζει.</p>
        {onSettings && balance !== null && (
          <button className="text-button" onClick={onSettings}>
            Ρύθμιση συντήρησης
          </button>
        )}
      </details>
      {onSettings && balance === null && (
        <button className="text-button" onClick={onSettings}>
          Ρύθμιση συντήρησης
        </button>
      )}
    </section>
  );
}
