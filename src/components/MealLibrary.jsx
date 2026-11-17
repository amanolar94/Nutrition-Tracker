import { t } from "../i18n.js";
import { useLanguage } from "../i18n-react.jsx";
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
    (template) =>
      JSON.stringify(templateFields(template)) ===
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
  useLanguage();
  const [removing, setRemoving] = useState(null),
    [error, setError] = useState("");
  const receipt = useRef(null);
  return (
    <Dialog
      title={t("Τα αγαπημένα σου γεύματα")}
      onClose={onClose}
      busy={busy}
      wide
    >
      <p className="muted">
        {t(
          "Ανάκαλεσέ τα και στο ChatGPT, π.χ. «το συνηθισμένο πρωινό μου». Κάθε επανάληψη ξεκινά ως πρόχειρο για έλεγχο.",
        )}
      </p>
      {!templates.length ? (
        <div className="empty">
          <Icon name="star" width="32" height="32" />
          <h3>{t("Κράτησε όσα τρως συχνά")}</h3>
          <p>
            {t(
              "Πάτησε το αστέρι σε ένα γεύμα ή ζήτησε από το ChatGPT να το αποθηκεύσει στα αγαπημένα.",
            )}
          </p>
        </div>
      ) : (
        <ul className="template-grid">
          {templates.map((template) => (
            <li className="template-card" key={template.id}>
              <span className="badge">{t(template.category)}</span>
              <h3>{template.name}</h3>
              <p>
                <b>{number(template.calories)} kcal</b>
                {t(" · Π ")}
                {number(template.protein)}
                {t(" · Υ")} {number(template.carbs)}
                {t(" · Λ ")}
                {number(template.fat)} g
              </p>
              <div className="template-actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => onRepeat(template)}
                >
                  <Icon name="plus" />
                  {t("Επανάληψη")}
                </button>
                <button
                  className="icon-button"
                  aria-label={t("Επεξεργασία αγαπημένου {v0}", {
                    v0: template.name,
                  })}
                  disabled={busy}
                  onClick={() => onEdit(template)}
                >
                  <Icon name="edit" />
                </button>
                <button
                  className="icon-button"
                  aria-label={t("Αφαίρεση αγαπημένου {v0}", {
                    v0: template.name,
                  })}
                  disabled={busy}
                  onClick={() => {
                    setRemoving(template);
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
          aria-label={t("Επιβεβαίωση αφαίρεσης αγαπημένου")}
        >
          <p>
            {t("Να αφαιρεθεί το ")}
            <b>{removing.name}</b>
            {t(" από τα αγαπημένα; Τα καταγεγραμμένα γεύματα διατηρούνται.")}
          </p>
          {error && (
            <p role="alert" className="form-feedback error">
              {t(error)}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              {t("Ακύρωση")}
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
              {t("Αφαίρεση αγαπημένου")}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
