import React, { useRef, useState } from "react";
import Dialog from "./Dialog.jsx";
import { number } from "../display.js";

export default function WorkoutEditor({
  workout,
  date,
  remove,
  busy,
  onClose,
  onSave,
}) {
  const [error, setError] = useState("");
  const request = useRef(null);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const data = remove ? null : new FormData(e.currentTarget);
    const values = remove
      ? { workout_id: workout.id }
      : {
          ...(workout ? { workout_id: workout.id } : {}),
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
      request.current = { signature, request_id: crypto.randomUUID() };
    setError("");
    if (
      !(await onSave(
        remove ? "deleteWorkout" : workout ? "updateWorkout" : "addWorkout",
        { ...values, request_id: request.current.request_id },
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
          ? "Διαγραφή προπόνησης;"
          : workout
            ? "Επεξεργασία προπόνησης"
            : "Καταγραφή προπόνησης"
      }
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {remove ? (
            <p>
              Θα διαγραφεί η προπόνηση <b>{workout.name}</b> (
              {number(workout.calories_burned)} kcal). Το ισοζύγιο θα
              ενημερωθεί.
            </p>
          ) : (
            <>
              <label>
                Προπόνηση
                <input
                  name="workout_name"
                  defaultValue={workout?.name || ""}
                  maxLength="120"
                  placeholder="π.χ. Τρέξιμο 45′"
                  required
                  autoFocus
                />
              </label>
              <label>
                Ημερομηνία προπόνησης
                <input
                  type="date"
                  name="workout_date"
                  defaultValue={workout?.date || date}
                  required
                />
              </label>
              <label>
                Ενεργές θερμίδες (kcal)
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
                Ενεργές θερμίδες άσκησης μόνο. Αν το ρολόι δείχνει «συνολικές»,
                μην τις προσθέσεις μαζί με τις ενεργές.
              </p>
            </>
          )}
          {error && (
            <p className="form-feedback error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Ακύρωση
            </button>
            <button type="submit" className={remove ? "danger" : "primary"}>
              {busy
                ? "Αποθήκευση…"
                : remove
                  ? "Διαγραφή προπόνησης"
                  : "Αποθήκευση προπόνησης"}
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
