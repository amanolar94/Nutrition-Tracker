import React, { useRef, useState } from "react";
import Dialog from "./Dialog.jsx";
import Icon from "./Icons.jsx";
import { metrics, number } from "../display.js";
export const templateFields = (meal) =>
  Object.fromEntries(
    ["name", "category", ...metrics.map(([key]) => key)].map((key) => [
      key,
      meal[key],
    ]),
  );
export const matchingTemplate = (meal, templates) =>
  templates.some(
    (t) =>
      JSON.stringify(templateFields(t)) ===
      JSON.stringify(templateFields(meal)),
  );
export default function MealLibrary({
  templates,
  busy,
  onClose,
  onRepeat,
  onEdit,
  onDelete,
}) {
  const [removing, setRemoving] = useState(null),
    [error, setError] = useState("");
  const receipt = useRef(null);
  return (
    <Dialog title="Τα αγαπημένα σου γεύματα" onClose={onClose} busy={busy} wide>
      <p className="muted">
        Ανάκαλεσέ τα και στο ChatGPT, π.χ. «το συνηθισμένο πρωινό μου». Κάθε
        επανάληψη ξεκινά ως πρόχειρο για έλεγχο.
      </p>
      {!templates.length ? (
        <div className="empty">
          <Icon name="star" width="32" height="32" />
          <h3>Κράτησε όσα τρως συχνά</h3>
          <p>
            Πάτησε το αστέρι σε ένα γεύμα ή ζήτησε από το ChatGPT να το
            αποθηκεύσει στα αγαπημένα.
          </p>
        </div>
      ) : (
        <ul className="template-grid">
          {templates.map((t) => (
            <li className="template-card" key={t.id}>
              <span className="badge">{t.category}</span>
              <h3>{t.name}</h3>
              <p>
                <b>{number(t.calories)} kcal</b> · Π {number(t.protein)} · Υ{" "}
                {number(t.carbs)} · Λ {number(t.fat)} g
              </p>
              <div className="template-actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => onRepeat(t)}
                >
                  <Icon name="plus" />
                  Επανάληψη
                </button>
                <button
                  className="icon-button"
                  aria-label={`Επεξεργασία αγαπημένου ${t.name}`}
                  disabled={busy}
                  onClick={() => onEdit(t)}
                >
                  <Icon name="edit" />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Αφαίρεση αγαπημένου ${t.name}`}
                  disabled={busy}
                  onClick={() => {
                    setRemoving(t);
                    setError("");
                    receipt.current = crypto.randomUUID();
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {removing && (
        <div
          className="library-confirm"
          role="group"
          aria-label="Επιβεβαίωση αφαίρεσης αγαπημένου"
        >
          <p>
            Να αφαιρεθεί το <b>{removing.name}</b> από τα αγαπημένα; Τα
            καταγεγραμμένα γεύματα διατηρούνται.
          </p>
          {error && (
            <p role="alert" className="form-feedback error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              Ακύρωση
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await onDelete({
                    request_id: receipt.current,
                    template_id: removing.id,
                  })
                )
                  setRemoving(null);
                else setError("Δεν επιβεβαιώθηκε η αφαίρεση. Δοκίμασε ξανά.");
              }}
            >
              Αφαίρεση αγαπημένου
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
