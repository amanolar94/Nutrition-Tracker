import React, { useRef, useState } from "react";
import Dialog from "./Dialog.jsx";
import DateInput from "./DateInput.jsx";
import { categories, metrics } from "../display.js";

// Opening a repeat is a draft only. The submit button is the explicit browser save.
export default function MealEditor({
  date,
  meal,
  template,
  favorite = false,
  legacy = false,
  timeEnabled = true,
  busy,
  onClose,
  onSave,
}) {
  const source = meal || template;
  const [error, setError] = useState("");
  const receipt = useRef(null);
  return (
    <Dialog
      title={
        favorite
          ? "Επεξεργασία αγαπημένου"
          : meal
            ? "Επεξεργασία γεύματος"
            : template
              ? "Επανάληψη γεύματος"
              : "Χειροκίνητη καταχώριση"
      }
      busy={busy}
      onClose={onClose}
    >
      <p className="muted">
        {favorite
          ? "Οι αλλαγές αφορούν το αγαπημένο. Οι προηγούμενες καταγραφές διατηρούνται."
          : "Έλεγξε τις ποσότητες και τις τιμές για ολόκληρο το γεύμα πριν αποθηκεύσεις."}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const f = new FormData(e.currentTarget);
          const payload = {
            name: f.get("name").trim(),
            category: f.get("category"),
          };
          for (const [key] of legacy ? metrics.slice(0, 2) : metrics)
            payload[key] = Number(f.get(key));
          if (!favorite) {
            payload.date = f.get("date");
            if (!legacy && timeEnabled)
              payload.meal_time = f.get("meal_time") || null;
          }
          if (meal) payload.meal_id = meal.id;
          if (favorite) payload.template_id = template.id;
          const content = JSON.stringify(payload);
          if (receipt.current?.content !== content)
            receipt.current = { content, id: crypto.randomUUID() };
          setError("");
          if (
            !(await onSave(
              favorite ? "saveMealTemplate" : meal ? "updateMeal" : "addMeal",
              { request_id: receipt.current.id, ...payload },
            ))
          )
            setError(
              "Η αποθήκευση δεν επιβεβαιώθηκε. Τα στοιχεία παραμένουν εδώ. Δοκίμασε ξανά.",
            );
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Όνομα γεύματος
            <input
              name="name"
              defaultValue={source?.name || ""}
              maxLength="120"
              autoFocus
              required
            />
          </label>
          <label>
            Κατηγορία
            <select
              name="category"
              defaultValue={source?.category || categories[0]}
            >
              {(legacy ? categories.slice(0, 4) : categories).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {!favorite && (
            <div className="pair">
              <label>
                Ημερομηνία
                <DateInput
                  name="date"
                  defaultValue={meal?.date || date}
                  required
                />
              </label>
              {!legacy && timeEnabled && (
                <label>
                  Ώρα (προαιρετική)
                  <input
                    name="meal_time"
                    type="time"
                    defaultValue={meal?.meal_time?.slice(0, 5) || ""}
                  />
                </label>
              )}
            </div>
          )}
          <div className="pair">
            {(legacy ? metrics.slice(0, 2) : metrics).map(
              ([key, label, unit]) => (
                <label key={key}>
                  {label} ({unit})
                  <input
                    name={key}
                    type="number"
                    inputMode="decimal"
                    defaultValue={source?.[key] ?? ""}
                    min={key === "calories" ? ".1" : "0"}
                    max={key === "calories" ? "100000" : "10000"}
                    step="any"
                    required
                  />
                </label>
              ),
            )}
          </div>
          {error && (
            <p className="form-feedback error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" type="submit">
            {busy
              ? "Αποθήκευση…"
              : favorite
                ? "Αποθήκευση αγαπημένου"
                : meal
                  ? "Αποθήκευση αλλαγών"
                  : "Αποθήκευση γεύματος"}
          </button>
        </fieldset>
      </form>
    </Dialog>
  );
}
