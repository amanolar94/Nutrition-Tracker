import { t } from "../i18n.js";
import { useLanguage } from "../i18n-react.jsx";
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
  useLanguage();
  const source = meal || template;
  const [error, setError] = useState("");
  const receipt = useRef(null);
  return (
    <Dialog
      title={
        favorite
          ? t("Επεξεργασία αγαπημένου")
          : meal
            ? t("Επεξεργασία γεύματος")
            : template
              ? t("Επανάληψη γεύματος")
              : t("Χειροκίνητη καταχώριση")
      }
      busy={busy}
      onClose={onClose}
    >
      <p className="muted">
        {favorite
          ? t(
              "Οι αλλαγές αφορούν το αγαπημένο. Οι προηγούμενες καταγραφές διατηρούνται.",
            )
          : t(
              "Έλεγξε τις ποσότητες και τις τιμές για ολόκληρο το γεύμα πριν αποθηκεύσεις.",
            )}
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
            receipt.current = {
              content,
              id: crypto.randomUUID(),
            };
          setError("");
          if (
            !(await onSave(
              favorite ? "saveMealTemplate" : meal ? "updateMeal" : "addMeal",
              {
                request_id: receipt.current.id,
                ...payload,
              },
            ))
          )
            setError(
              "Η αποθήκευση δεν επιβεβαιώθηκε. Τα στοιχεία παραμένουν εδώ. Δοκίμασε ξανά.",
            );
        }}
      >
        <fieldset disabled={busy}>
          <label>
            {t("Όνομα γεύματος")}
            <input
              name="name"
              defaultValue={source?.name || ""}
              maxLength="120"
              autoFocus
              required
            />
          </label>
          <label>
            {t("Κατηγορία")}
            <select
              name="category"
              aria-label={t("Κατηγορία")}
              defaultValue={source?.category || categories[0]}
            >
              {(legacy ? categories.slice(0, 4) : categories).map((c) => (
                <option key={c} value={c}>
                  {t(c)}
                </option>
              ))}
            </select>
          </label>
          {!favorite && (
            <div className="pair">
              <label>
                {t("Ημερομηνία")}
                <DateInput
                  name="date"
                  defaultValue={meal?.date || date}
                  required
                />
              </label>
              {!legacy && timeEnabled && (
                <label>
                  {t("Ώρα (προαιρετική)")}
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
                  {t(label)} ({unit})
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
              {t(error)}
            </p>
          )}
          <button className="primary" type="submit">
            {busy
              ? t("Αποθήκευση…")
              : favorite
                ? t("Αποθήκευση αγαπημένου")
                : meal
                  ? t("Αποθήκευση αλλαγών")
                  : t("Αποθήκευση γεύματος")}
          </button>
        </fieldset>
      </form>
    </Dialog>
  );
}
