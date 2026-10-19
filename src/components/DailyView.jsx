import React, { useState } from "react";
import { metrics, number, budgetLabel, categories } from "../display.js";
import { totals } from "../nutrition.js";
import Icon from "./Icons.jsx";
import EnergyBalance from "./EnergyBalance.jsx";
import WorkoutLog from "./WorkoutLog.jsx";
import { matchingTemplate } from "./MealLibrary.jsx";
function Meter({ value, target, label }) {
  return (
    <progress
      aria-label={label}
      max={Math.max(1, target)}
      value={Math.min(value, Math.max(1, target))}
    />
  );
}
export default function DailyView({
  daily,
  sum,
  fuel,
  date,
  goals,
  mode,
  onMode,
  onAdd,
  onEdit,
  onDelete,
  onRepeat,
  onFavorite,
  onLibrary,
  templates,
  disabled,
  migrationPending,
  diaryMigrationPending,
  energy,
  workouts,
  onWorkout,
  onSettings,
  energyMigrationPending,
}) {
  const [filter, setFilter] = useState("all");
  const target = (key) => goals[mode === "rest" ? key : `training_${key}`];
  const incomplete = daily.some((m) => m.carbs == null || m.fat == null);
  const visible = daily.filter(
    (m) =>
      filter === "all" ||
      (m.category === "Τροφοδοσία προπόνησης") === (filter === "fuel"),
  );
  return (
    <div className="day-content">
      <div className="day-context">
        <label className="day-type">
          <span>Τύπος ημέρας</span>
          <select
            aria-label="Στόχοι ημέρας"
            value={mode}
            disabled={disabled || migrationPending || diaryMigrationPending}
            onChange={(e) => onMode(e.target.value)}
          >
            <option value="rest">Ανάπαυση</option>
            <option value="training">Προπόνηση</option>
          </select>
        </label>
        <span className="data-note">
          {diaryMigrationPending
            ? "Η αποθήκευση τύπου ημέρας και τα αγαπημένα θα ενεργοποιηθούν μετά την ενημέρωση της βάσης."
            : "Αποθηκεύεται για αυτή την ημερομηνία"}
        </span>
      </div>
      <div className="daily-summary">
        <section className="energy-card stat" data-metric="calories">
          <h2>Πρόσληψη ημέρας</h2>
          <div className="energy-value">
            <strong>{number(sum.calories)}</strong>
            <span>
              kcal{" "}
              <span className="energy-goal">
                / {number(target("calories"))} στόχος
              </span>
            </span>
          </div>
          <Meter
            value={sum.calories}
            target={target("calories")}
            label="Πρόοδος θερμίδων"
          />
          <p>{budgetLabel(sum.calories, target("calories"), "kcal")}</p>
        </section>
        <section className="macro-stats" aria-label="Μακροθρεπτικά ημέρας">
          {metrics.slice(1).map(([key, label]) => (
            <article
              className={`macro-card stat ${key}`}
              data-metric={key}
              key={key}
            >
              <h3>{label}</h3>
              <div>
                <strong>{number(sum[key])}</strong>
                <span> g</span>
              </div>
              <span className="macro-target">
                / {number(target(key))} g στόχος
              </span>
              <Meter
                value={sum[key]}
                target={target(key)}
                label={`Πρόοδος ${label.toLowerCase()}`}
              />
            </article>
          ))}
        </section>
      </div>
      {incomplete && (
        <p className="data-note" role="status">
          Κάποια γεύματα έχουν άγνωστους υδατάνθρακες ή λιπαρά. Τα σύνολα είναι
          ελλιπή.
        </p>
      )}
      <EnergyBalance energy={energy} onSettings={onSettings} compact />
      <div className="diary-layout">
        <section className="panel diary">
          <div className="section-title">
            <div>
              <p className="eyebrow">
                ΗΜΕΡΟΛΟΓΙΟ · {daily.length}{" "}
                {daily.length === 1 ? "ΓΕΥΜΑ" : "ΓΕΥΜΑΤΑ"}
              </p>
              <h2>Τα γεύματά σου</h2>
            </div>
            <div className="diary-actions">
              <button
                className="secondary compact"
                aria-label="Αγαπημένα γεύματα"
                onClick={onLibrary}
                disabled={disabled || diaryMigrationPending}
              >
                <Icon name="star" />
                <span>Αγαπημένα</span>
              </button>
              <button
                className="icon-button"
                aria-label="Χειροκίνητη προσθήκη"
                onClick={onAdd}
                disabled={disabled}
              >
                <Icon name="plus" />
              </button>
            </div>
          </div>
          <div
            className="diary-filters"
            role="group"
            aria-label="Φίλτρο γευμάτων"
          >
            {[
              ["all", "Όλα"],
              ["meals", "Γεύματα"],
              ["fuel", "Workout fueling"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {!visible.length ? (
            <div className="empty">
              <div className="empty-icon">
                <Icon
                  name={filter === "fuel" ? "fuel" : "meal"}
                  width="28"
                  height="28"
                />
              </div>
              <h3>
                {daily.length
                  ? "Δεν υπάρχουν γεύματα σε αυτό το φίλτρο"
                  : "Δεν υπάρχουν γεύματα ακόμη"}
              </h3>
              <p>
                Κατάγραψε το γεύμα σου στο ChatGPT και επιβεβαίωσε την
                αποθήκευση. Θα εμφανιστεί εδώ.
              </p>
              <button
                className="text-button"
                disabled={disabled}
                onClick={onAdd}
              >
                Ή πρόσθεσέ το χειροκίνητα
              </button>
            </div>
          ) : (
            categories.map((category) => {
              const records = visible
                .filter((m) => m.category === category)
                .sort((a, b) =>
                  (a.meal_time || "99").localeCompare(b.meal_time || "99"),
                );
              return records.length ? (
                <section
                  className={`meal-group ${category === "Τροφοδοσία προπόνησης" ? "fuel-group" : ""}`}
                  key={category}
                >
                  <div className="group-title">
                    <h3>{category}</h3>
                    <span>{number(totals(records, date).calories)} kcal</span>
                  </div>
                  <ul>
                    {records.map((m) => (
                      <li className="meal-card" key={m.id}>
                        <div className="meal-top">
                          <div className="meal-name">
                            <h4>{m.name}</h4>
                            {m.meal_time && (
                              <time
                                className="meal-time"
                                dateTime={`${m.date}T${m.meal_time}`}
                              >
                                {m.meal_time.slice(0, 5)}
                              </time>
                            )}
                          </div>
                          <div className="meal-energy">
                            <strong>{number(m.calories)}</strong>
                            <span>kcal</span>
                          </div>
                        </div>
                        <dl className="meal-macros">
                          {metrics.slice(1).map(([key, label]) => (
                            <div key={key}>
                              <dt>{label}</dt>
                              <dd>
                                {m[key] == null
                                  ? "Άγνωστο"
                                  : `${number(m[key])} g`}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <div className="meal-actions">
                          <button
                            className="icon-button favorite"
                            aria-label={`${matchingTemplate(m, templates) ? "Στα αγαπημένα" : "Αγαπημένο"} ${m.name}`}
                            disabled={
                              disabled ||
                              diaryMigrationPending ||
                              m.carbs == null ||
                              m.fat == null ||
                              matchingTemplate(m, templates)
                            }
                            onClick={() => onFavorite(m)}
                          >
                            <Icon name="star" />
                          </button>
                          <button
                            className="text-button"
                            disabled={disabled}
                            onClick={() => onRepeat(m)}
                          >
                            <Icon name="plus" />
                            Επανάληψη
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Επεξεργασία ${m.name}`}
                            disabled={disabled || migrationPending}
                            onClick={() => onEdit(m)}
                          >
                            <Icon name="edit" />
                          </button>
                          <button
                            className="icon-button delete"
                            aria-label={`Διαγραφή ${m.name}`}
                            disabled={disabled}
                            onClick={() => onDelete(m)}
                          >
                            <Icon name="trash" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null;
            })
          )}
        </section>
        <aside className="day-sidebar">
          <section className="panel fueling">
            <div className="section-title">
              <h2>
                <Icon name="fuel" />
                Workout fueling
              </h2>
              <span className="badge">Τροφοδοσία</span>
            </div>
            <p className="fuel-total">
              <b>{number(fuel.carbs)} g</b> υδατάνθρακες{" "}
              <span>· {number(fuel.calories)} kcal</span>
            </p>
            <p className="data-note">
              Περιλαμβάνεται ήδη στην πρόσληψη και στα macros της ημέρας.
            </p>
          </section>
          <WorkoutLog
            workouts={workouts}
            onAdd={() => onWorkout({})}
            onEdit={(w) => onWorkout({ workout: w })}
            onDelete={(w) => onWorkout({ workout: w, remove: true })}
            disabled={disabled}
            pending={energyMigrationPending}
          />
        </aside>
      </div>
    </div>
  );
}
