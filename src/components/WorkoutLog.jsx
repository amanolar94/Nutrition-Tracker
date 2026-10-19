import React from "react";
import { number } from "../display.js";
import Icon from "./Icons.jsx";
export default function WorkoutLog({
  workouts,
  onAdd,
  onEdit,
  onDelete,
  disabled,
  pending,
}) {
  return (
    <section className="panel workout-log">
      <div className="section-title">
        <h2>Οι προπονήσεις σου</h2>
        <button
          className="secondary compact"
          disabled={disabled || pending}
          onClick={onAdd}
          aria-label="Προσθήκη προπόνησης"
        >
          <Icon name="plus" />
        </button>
      </div>
      {pending ? (
        <p className="data-note">
          Η καταγραφή προπόνησης θα είναι διαθέσιμη μετά την ενημέρωση της
          βάσης.
        </p>
      ) : (
        <>
          {workouts.length ? (
            <ul>
              {workouts.map((w) => (
                <li key={w.id} className="workout-row">
                  <div>
                    <h3>{w.name}</h3>
                    <p>
                      {number(w.calories_burned)} kcal{" "}
                      <span className="muted">ενεργές</span>
                    </p>
                  </div>
                  <div className="workout-actions">
                    <button
                      className="icon-button"
                      disabled={disabled}
                      onClick={() => onEdit(w)}
                      aria-label={`Επεξεργασία προπόνησης ${w.name}`}
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      className="icon-button delete"
                      disabled={disabled}
                      onClick={() => onDelete(w)}
                      aria-label={`Διαγραφή προπόνησης ${w.name}`}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Δεν υπάρχουν προπονήσεις. Κατάγραψέ τες στο ChatGPT ή πάτησε +.
            </p>
          )}
          <p className="data-note">
            Πρόσθεσε μόνο τις ενεργές θερμίδες άσκησης από το ρολόι ή την
            εκτίμησή σου, χωρίς θερμίδες ηρεμίας.
          </p>
        </>
      )}
    </section>
  );
}
