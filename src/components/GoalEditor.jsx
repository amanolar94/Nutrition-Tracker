import React, { useState } from "react";
import { metrics } from "../display.js";
export default function GoalEditor({ goals, migrationPending, busy, onSave }) {
  const [edits, setEdits] = useState({}),
    [mode, setMode] = useState("rest"),
    [feedback, setFeedback] = useState("");
  const draft = { ...goals, ...edits },
    dirty = Object.keys(edits).length > 0;
  return (
    <section className="panel goals">
      <h2>Οι διατροφικοί σου στόχοι</h2>
      <p className="muted">Άλλαξε τους στόχους ανάπαυσης και προπόνησης.</p>
      <div className="segmented" role="group" aria-label="Επεξεργασία στόχων">
        <button
          type="button"
          disabled={busy}
          aria-pressed={mode === "rest"}
          onClick={() => setMode("rest")}
        >
          Ανάπαυση
        </button>
        <button
          type="button"
          aria-pressed={mode === "training"}
          disabled={busy || migrationPending}
          onClick={() => setMode("training")}
        >
          Προπόνηση
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const keys = (
            migrationPending ? ["rest"] : ["rest", "training"]
          ).flatMap((m) =>
            (migrationPending ? metrics.slice(0, 2) : metrics).map(([key]) =>
              m === "rest" ? key : `training_${key}`,
            ),
          );
          const next = Object.fromEntries(
            keys.map((key) => [key, Number(draft[key])]),
          );
          if (
            keys.some(
              (k) =>
                !Number.isFinite(next[k]) ||
                (k.includes("calories") || k.includes("protein")
                  ? next[k] <= 0
                  : next[k] < 0),
            )
          ) {
            setFeedback("Έλεγξε τις τιμές των στόχων και στις δύο κατηγορίες.");
            return;
          }
          setFeedback("");
          if (await onSave(next)) {
            setEdits({});
            setFeedback("Οι στόχοι αποθηκεύτηκαν.");
          } else setFeedback("Οι στόχοι δεν αποθηκεύτηκαν. Δοκίμασε ξανά.");
        }}
      >
        <fieldset disabled={busy}>
          <div className="pair">
            {(migrationPending ? metrics.slice(0, 2) : metrics).map(
              ([key, label, unit]) => {
                const name = mode === "rest" ? key : `training_${key}`;
                return (
                  <label key={name}>
                    {label} ({unit})
                    <input
                      name={`${mode}_${key}`}
                      value={draft[name] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEdits((previous) => {
                          const next = { ...previous };
                          if (value === String(goals[name])) delete next[name];
                          else next[name] = value;
                          return next;
                        });
                        setFeedback("");
                      }}
                      type="number"
                      inputMode="decimal"
                      min={key === "calories" || key === "protein" ? ".1" : "0"}
                      step="any"
                      required
                    />
                  </label>
                );
              },
            )}
          </div>
          <button className="primary" disabled={!dirty}>
            {busy ? "Αποθήκευση…" : "Αποθήκευση στόχων"}
          </button>
        </fieldset>
      </form>
      {feedback && (
        <p role="status" className="form-feedback">
          {feedback}
        </p>
      )}
      {dirty && (
        <p className="data-note">Υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί.</p>
      )}
      <p className="data-note">
        Οι αρχικοί στόχοι είναι ενδεικτικοί. Προσάρμοσέ τους στις ανάγκες σου.
      </p>
    </section>
  );
}
