import { t } from "../i18n.js";
import { useLanguage } from "../i18n-react.jsx";
import React, { useRef, useState } from "react";
import Dialog from "./Dialog.jsx";
import DateInput from "./DateInput.jsx";
import { number } from "../display.js";
export default function WorkoutEditor({
  workout,
  date,
  remove,
  busy,
  onClose,
  onSave,
}) {
  useLanguage();
  const [error, setError] = useState("");
  const request = useRef(null);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const data = remove ? null : new FormData(e.currentTarget);
    const values = remove
      ? {
          workout_id: workout.id,
        }
      : {
          ...(workout
            ? {
                workout_id: workout.id,
              }
            : {}),
          date: data.get("workout_date"),
          name: data.get("workout_name").trim(),
          calories_burned: Number(data.get("calories_burned")),
        };
    if (
      !remove &&
      (!values.name ||
        !Number.isFinite(values.calories_burned) ||
        values.calories_burned <= 0 ||
        values.calories_burned > 20000)
    ) {
      setError("Έλεγξε το όνομα και τις θερμίδες προπόνησης.");
      return;
    }
    const signature = JSON.stringify(values);
    if (request.current?.signature !== signature)
      request.current = {
        signature,
        request_id: crypto.randomUUID(),
      };
    setError("");
    if (
      !(await onSave(
        remove ? "deleteWorkout" : workout ? "updateWorkout" : "addWorkout",
        {
          ...values,
          request_id: request.current.request_id,
        },
      ))
    )
      setError(
        "Η αλλαγή δεν επιβεβαιώθηκε. Δοκίμασε ξανά· η ίδια αίτηση δεν δημιουργεί διπλή καταχώριση.",
      );
  }
  return (
    <Dialog
      title={
        remove
          ? t("Διαγραφή προπόνησης;")
          : workout
            ? t("Επεξεργασία προπόνησης")
            : t("Καταγραφή προπόνησης")
      }
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {remove ? (
            <p>
              {t("Θα διαγραφεί η προπόνηση ")}
              <b>{workout.name}</b> ({number(workout.calories_burned)}
              {t(" kcal). Το ισοζύγιο θα ενημερωθεί.")}
            </p>
          ) : (
            <>
              <label>
                {t("Προπόνηση")}
                <input
                  name="workout_name"
                  defaultValue={workout?.name || ""}
                  maxLength="120"
                  placeholder={t("π.χ. Τρέξιμο 45′")}
                  required
                  autoFocus
                />
              </label>
              <label>
                {t("Ημερομηνία προπόνησης")}
                <DateInput
                  name="workout_date"
                  defaultValue={workout?.date || date}
                  required
                />
              </label>
              <label>
                {t("Ενεργές θερμίδες (kcal)")}
                <input
                  name="calories_burned"
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  max="20000"
                  step="any"
                  defaultValue={workout?.calories_burned ?? ""}
                  required
                />
              </label>
              <p className="data-note">
                {t(
                  "Ενεργές θερμίδες άσκησης μόνο. Αν το ρολόι δείχνει «συνολικές», μην τις προσθέσεις μαζί με τις ενεργές.",
                )}
              </p>
            </>
          )}
          {error && (
            <p className="form-feedback error" role="alert">
              {t(error)}
            </p>
          )}
          <div className="dialog-actions">
            <button type="button" className="secondary" onClick={onClose}>
              {t("Ακύρωση")}
            </button>
            <button type="submit" className={remove ? "danger" : "primary"}>
              {busy
                ? t("Αποθήκευση…")
                : remove
                  ? t("Διαγραφή προπόνησης")
                  : t("Αποθήκευση προπόνησης")}
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
