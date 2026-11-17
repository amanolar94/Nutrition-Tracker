import { t } from "../i18n.js";
import { useLanguage } from "../i18n-react.jsx";
import React from "react";
import { number } from "../display.js";
export default function EnergyBalance({
  energy,
  weekly = false,
  onSettings,
  compact = false,
}) {
  useLanguage();
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
      ? t("Δεν υπάρχει εκτίμηση")
      : balance < 0
        ? t("Εκτιμώμενο έλλειμμα")
        : balance > 0
          ? t("Εκτιμώμενο πλεόνασμα")
          : t("Εκτιμώμενη ισορροπία");
  return (
    <section
      className={`panel balance-card ${kind}${compact ? " balance-compact" : ""}`}
      aria-label={
        weekly
          ? t("Ενεργειακό ισοζύγιο εβδομάδας")
          : t("Ενεργειακό ισοζύγιο ημέρας")
      }
    >
      <div className="section-title">
        <h2>{t("Ενεργειακό ισοζύγιο")}</h2>
        {weekly && (
          <span className="badge">
            {energy.included_days}
            {t("/7 ημέρες")}
          </span>
        )}
      </div>
      <p className="balance-label">{t(label)}</p>
      <div className="balance-value">
        <strong>{balance === null ? "—" : number(Math.abs(balance))}</strong>
        <span>kcal</span>
      </div>
      {!compact && balance !== null && (
        <dl className="nutrition-list balance-equation">
          <div>
            <dt>{t("Φαγητό")}</dt>
            <dd>{number(energy.intake_calories)} kcal</dd>
          </div>
          <div>
            <dt>
              {t("Καύσεις")}
              {weekly ? t(" στις ημέρες σύγκρισης") : ""}
            </dt>
            <dd>{number(energy.estimated_expenditure_calories)} kcal</dd>
          </div>
        </dl>
      )}
      {!weekly && !compact && (
        <p className="balance-breakdown">
          {t("Συντήρηση")}{" "}
          {energy.maintenance_calories === null
            ? "—"
            : number(energy.maintenance_calories)}{" "}
          {t("+ προπόνηση ")}
          <b>{number(energy.workout_calories)} kcal</b>
        </p>
      )}
      {weekly && !compact && (
        <p className="data-note">
          {t("Προπονήσεις ολόκληρης εβδομάδας:")}{" "}
          <b>{number(energy.workout_calories)} kcal</b>.
        </p>
      )}
      {balance === null && (
        <p className="data-note">
          {weekly
            ? t(
                "Για εκτίμηση χρειάζονται συντήρηση και γεύματα σε τουλάχιστον μία ημέρα έως σήμερα.",
              )
            : energy.unavailable_reason === "maintenance_not_set"
              ? t("Όρισε τη συντήρησή σου για να δεις έλλειμμα ή πλεόνασμα.")
              : energy.unavailable_reason === "future_date"
                ? t("Το ισοζύγιο θα εμφανιστεί όταν φτάσει αυτή η ημέρα.")
                : t("Δεν υπάρχουν καταγεγραμμένα γεύματα για αυτή την ημέρα.")}
        </p>
      )}
      {!compact && (
        <p className="data-note">
          {weekly ? t("Μόνο ημέρες έως σήμερα με γεύματα και συντήρηση. ") : ""}
          {t("Εκτίμηση με όσα έχεις καταγράψει μέχρι τώρα.")}
        </p>
      )}
      {compact && (
        <div className="compact-equation">
          <span>
            {t("Φαγητό ")}
            <b>{number(energy.intake_calories)}</b>
          </span>
          <span>
            {t("Προπόνηση")}{" "}
            <b>
              {number(
                weekly
                  ? energy.included_workout_calories
                  : energy.workout_calories,
              )}
            </b>
          </span>
          <span>
            {weekly ? t("Καύσεις στις ημέρες σύγκρισης") : t("Συντήρηση")}{" "}
            <b>
              {(weekly
                ? energy.estimated_expenditure_calories
                : energy.maintenance_calories) === null
                ? "—"
                : number(
                    weekly
                      ? energy.estimated_expenditure_calories
                      : energy.maintenance_calories,
                  )}
            </b>
          </span>
        </div>
      )}
      {compact && balance !== null && (
        <p className="data-note estimate-note">
          {t("Με όσα έχουν καταγραφεί μέχρι τώρα")}
          {weekly
            ? t(" · {v0}/7 ημέρες", {
                v0: energy.included_days,
              })
            : t(" · μπορεί να λείπουν γεύματα")}
          .
        </p>
      )}
      <details className="balance-help">
        <summary>{t("Πώς υπολογίζεται;")}</summary>
        {weekly && (
          <p>
            {t("Προπονήσεις ολόκληρης εβδομάδας: ")}
            {number(energy.workout_calories)}{" "}
            {t("kcal. Στο ισοζύγιο συμμετέχουν")}{" "}
            {number(energy.included_workout_calories)}
            {t(" kcal από τις ημέρες σύγκρισης.")}
          </p>
        )}
        <p>
          {t(
            "Φαγητό − (συντήρηση χωρίς άσκηση + ενεργές θερμίδες προπόνησης). Αρνητικό σημαίνει έλλειμμα, θετικό πλεόνασμα. Η τροφοδοσία προπόνησης περιλαμβάνεται στο φαγητό. Χρησιμοποιείται η τρέχουσα ρύθμιση συντήρησης για όλες τις ημερομηνίες.",
          )}
        </p>
        <p>{t("Αν λείπουν γεύματα ή προπονήσεις, το αποτέλεσμα αλλάζει.")}</p>
        {onSettings && balance !== null && (
          <button className="text-button" onClick={onSettings}>
            {t("Ρύθμιση συντήρησης")}
          </button>
        )}
      </details>
      {onSettings && balance === null && (
        <button className="text-button" onClick={onSettings}>
          {t("Ρύθμιση συντήρησης")}
        </button>
      )}
    </section>
  );
}
