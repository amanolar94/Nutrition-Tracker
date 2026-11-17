import { t } from "../i18n.js";
import { useLanguage } from "../i18n-react.jsx";
import React, { useState } from "react";
import { metrics } from "../display.js";
export default function GoalEditor({ goals, migrationPending, busy, onSave }) {
  useLanguage();
  const [edits, setEdits] = useState({}),
    [feedback, setFeedback] = useState("");
  const draft = {
      ...goals,
      ...edits,
    },
    dirty = Object.keys(edits).length > 0;
  return (
    <section className="panel goals">
      <h2>{t("Οι διατροφικοί σου στόχοι")}</h2>
      <p className="muted">
        {t(
          "Σύγκρινε και άλλαξε τους δύο στόχους πρόσληψης. Η συντήρηση για το ισοζύγιο ρυθμίζεται χωριστά.",
        )}
      </p>
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
          <div className="goal-columns">
            {(migrationPending ? ["rest"] : ["rest", "training"]).map(
              (mode) => (
                <div className="goal-column" key={mode}>
                  <h3>{mode === "rest" ? t("Ανάπαυση") : t("Προπόνηση")}</h3>
                  {(migrationPending ? metrics.slice(0, 2) : metrics).map(
                    ([key, label, unit]) => {
                      const name = mode === "rest" ? key : `training_${key}`;
                      return (
                        <label key={name}>
                          {t(label)} ({unit})
                          <input
                            name={`${mode}_${key}`}
                            value={draft[name] ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setEdits((previous) => {
                                const next = {
                                  ...previous,
                                };
                                if (value === String(goals[name]))
                                  delete next[name];
                                else next[name] = value;
                                return next;
                              });
                              setFeedback("");
                            }}
                            type="number"
                            inputMode="decimal"
                            min={
                              key === "calories" || key === "protein"
                                ? ".1"
                                : "0"
                            }
                            max={key === "calories" ? "100000" : "10000"}
                            step="any"
                            required
                          />
                        </label>
                      );
                    },
                  )}
                </div>
              ),
            )}
          </div>
          <button className="primary" disabled={!dirty}>
            {busy ? t("Αποθήκευση…") : t("Αποθήκευση στόχων")}
          </button>
        </fieldset>
      </form>
      {feedback && (
        <p role="status" className="form-feedback">
          {t(feedback)}
        </p>
      )}
      {dirty && (
        <p className="data-note">
          {t("Υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί.")}
        </p>
      )}
      <p className="data-note">
        {t(
          "Οι αρχικοί στόχοι είναι ενδεικτικοί. Προσάρμοσέ τους στις ανάγκες σου.",
        )}
      </p>
    </section>
  );
}
