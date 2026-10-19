import React, { useRef, useState } from "react";

export default function EnergySettings({ settings, pending, busy, onSave }) {
  const [edit, setEdit] = useState(undefined),
    [feedback, setFeedback] = useState("");
  const request = useRef(null);
  // 2000 is the user's proposed estimate, not a persisted or inferred measurement.
  const value = edit ?? settings.maintenance_calories ?? 2000;
  return (
    <section className="panel energy-settings" id="energy-settings">
      <h2>Συντήρηση και ισοζύγιο</h2>
      <p className="muted">
        Θερμίδες που εκτιμάς ότι καις σε μία ημέρα με τις συνηθισμένες
        δραστηριότητες, χωρίς προπόνηση. Διαφέρει από τον βασικό μεταβολισμό και
        από τον στόχο φαγητού.
      </p>
      {pending ? (
        <p className="data-note">
          Η ρύθμιση θα ενεργοποιηθεί μετά την ενημέρωση της βάσης.
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const maintenance = value === "" ? null : Number(value);
            if (
              maintenance !== null &&
              (!Number.isFinite(maintenance) ||
                maintenance < 500 ||
                maintenance > 10000)
            ) {
              setFeedback("Δώσε τιμή από 500 έως 10.000 kcal.");
              return;
            }
            if (request.current?.value !== maintenance)
              request.current = {
                value: maintenance,
                request_id: crypto.randomUUID(),
              };
            if (
              await onSave("updateEnergySettings", {
                request_id: request.current.request_id,
                maintenance_calories: maintenance,
              })
            ) {
              request.current = null;
              setEdit(undefined);
              setFeedback(
                maintenance === null
                  ? "Η εκτίμηση συντήρησης αφαιρέθηκε."
                  : "Η συντήρηση αποθηκεύτηκε.",
              );
            } else
              setFeedback("Δεν επιβεβαιώθηκε η αποθήκευση. Δοκίμασε ξανά.");
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Συντήρηση χωρίς προπόνηση (kcal/ημέρα)
              <input
                name="maintenance_calories"
                type="number"
                inputMode="decimal"
                min="500"
                max="10000"
                step="any"
                value={value}
                onChange={(e) => {
                  setEdit(e.target.value);
                  setFeedback("");
                }}
              />
            </label>
            {settings.maintenance_calories === null && (
              <p className="data-note">
                Δεν έχει αποθηκευτεί συντήρηση. Η προτεινόμενη αρχική τιμή είναι
                2.000 kcal· αποθήκευσέ την για να ενεργοποιηθεί ο υπολογισμός.
              </p>
            )}
            <button
              className="primary"
              disabled={
                edit === undefined && settings.maintenance_calories !== null
              }
            >
              {busy ? "Αποθήκευση…" : "Αποθήκευση συντήρησης"}
            </button>
          </fieldset>
        </form>
      )}
      {feedback && (
        <p className="form-feedback" role="status">
          {feedback}
        </p>
      )}
      <p className="data-note">
        Οι ενεργές θερμίδες προπόνησης προστίθενται ξεχωριστά. Αλλαγή συντήρησης
        επανυπολογίζει και τις προηγούμενες ημέρες. Κενή τιμή απενεργοποιεί την
        εκτίμηση.
      </p>
    </section>
  );
}
