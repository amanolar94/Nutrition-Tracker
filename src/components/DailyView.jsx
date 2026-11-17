import { t } from "../i18n.js";
import { useLanguage } from "../i18n-react.jsx";
import React, { useState } from "react";
import { metrics, number, budgetLabel, categories } from "../display.js";
import { totals } from "../nutrition.js";
import Icon from "./Icons.jsx";
import EnergyBalance from "./EnergyBalance.jsx";
import WorkoutLog from "./WorkoutLog.jsx";
import { matchingTemplate } from "./MealLibrary.jsx";
function Meter({ value, target, label }) {
  useLanguage();
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
  useLanguage();
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
          <span>{t("Τύπος ημέρας")}</span>
          <select
            aria-label={t("Στόχοι ημέρας")}
            value={mode}
            disabled={disabled || migrationPending || diaryMigrationPending}
            onChange={(e) => onMode(e.target.value)}
          >
            <option value="rest">{t("Ανάπαυση")}</option>
            <option value="training">{t("Προπόνηση")}</option>
          </select>
        </label>
        <span className="data-note">
          {diaryMigrationPending
            ? t(
                "Η αποθήκευση τύπου ημέρας και τα αγαπημένα θα ενεργοποιηθούν μετά την ενημέρωση της βάσης.",
              )
            : t("Αποθηκεύεται για αυτή την ημερομηνία")}
        </span>
      </div>
      <div className="daily-summary">
        <section className="energy-card stat" data-metric="calories">
          <h2>{t("Πρόσληψη ημέρας")}</h2>
          <div className="energy-value">
            <strong>{number(sum.calories)}</strong>
            <span>
              kcal{" "}
              <span className="energy-goal">
                / {number(target("calories"))}
                {t(" στόχος")}
              </span>
            </span>
          </div>
          <Meter
            value={sum.calories}
            target={target("calories")}
            label={t("Πρόοδος θερμίδων")}
          />
          <p>{budgetLabel(sum.calories, target("calories"), "kcal")}</p>
        </section>
        <section className="macro-stats" aria-label={t("Μακροθρεπτικά ημέρας")}>
          {metrics.slice(1).map(([key, label]) => (
            <article
              className={`macro-card stat ${key}`}
              data-metric={key}
              key={key}
            >
              <h3>{t(label)}</h3>
              <div>
                <strong>{number(sum[key])}</strong>
                <span> g</span>
              </div>
              <span className="macro-target">
                / {number(target(key))}
                {t(" g στόχος")}
              </span>
              <Meter
                value={sum[key]}
                target={target(key)}
                label={t("Πρόοδος {v0}", {
                  v0: t(label).toLowerCase(),
                })}
              />
            </article>
          ))}
        </section>
      </div>
      {incomplete && (
        <p className="data-note" role="status">
          {t(
            "Κάποια γεύματα έχουν άγνωστους υδατάνθρακες ή λιπαρά. Τα σύνολα είναι ελλιπή.",
          )}
        </p>
      )}
      <EnergyBalance energy={energy} onSettings={onSettings} compact />
      <div className="diary-layout">
        <section className="panel diary">
          <div className="section-title">
            <div>
              <p className="eyebrow">
                {t("ΗΜΕΡΟΛΟΓΙΟ · ")}
                {daily.length} {daily.length === 1 ? t("ΓΕΥΜΑ") : t("ΓΕΥΜΑΤΑ")}
              </p>
              <h2>{t("Τα γεύματά σου")}</h2>
            </div>
            <div className="diary-actions">
              <button
                className="secondary compact"
                aria-label={t("Αγαπημένα γεύματα")}
                onClick={onLibrary}
                disabled={disabled || diaryMigrationPending}
              >
                <Icon name="star" />
                <span>{t("Αγαπημένα")}</span>
              </button>
              <button
                className="icon-button"
                aria-label={t("Χειροκίνητη προσθήκη")}
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
            aria-label={t("Φίλτρο γευμάτων")}
          >
            {[
              ["all", t("Όλα")],
              ["meals", t("Γεύματα")],
              ["fuel", "Workout fueling"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {t(label)}
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
                  ? t("Δεν υπάρχουν γεύματα σε αυτό το φίλτρο")
                  : t("Δεν υπάρχουν γεύματα ακόμη")}
              </h3>
              <p>
                {t(
                  "Κατάγραψε το γεύμα σου στο ChatGPT και επιβεβαίωσε την αποθήκευση. Θα εμφανιστεί εδώ.",
                )}
              </p>
              <button
                className="text-button"
                disabled={disabled}
                onClick={onAdd}
              >
                {t("Ή πρόσθεσέ το χειροκίνητα")}
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
                    <h3>{t(category)}</h3>
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
                              <dt>{t(label)}</dt>
                              <dd>
                                {m[key] == null
                                  ? t("Άγνωστο")
                                  : `${number(m[key])} g`}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <div className="meal-actions">
                          <button
                            className="icon-button favorite"
                            aria-label={`${matchingTemplate(m, templates) ? t("Στα αγαπημένα") : t("Αγαπημένο")} ${m.name}`}
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
                            {t("Επανάληψη")}
                          </button>
                          <button
                            className="icon-button"
                            aria-label={t("Επεξεργασία {v0}", {
                              v0: m.name,
                            })}
                            disabled={disabled || migrationPending}
                            onClick={() => onEdit(m)}
                          >
                            <Icon name="edit" />
                          </button>
                          <button
                            className="icon-button delete"
                            aria-label={t("Διαγραφή {v0}", {
                              v0: m.name,
                            })}
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
              <span className="badge">{t("Τροφοδοσία")}</span>
            </div>
            <p className="fuel-total">
              <b>{number(fuel.carbs)} g</b>
              {t(" υδατάνθρακες")} <span>· {number(fuel.calories)} kcal</span>
            </p>
            <p className="data-note">
              {t("Περιλαμβάνεται ήδη στην πρόσληψη και στα macros της ημέρας.")}
            </p>
          </section>
          <WorkoutLog
            workouts={workouts}
            onAdd={() => onWorkout({})}
            onEdit={(w) =>
              onWorkout({
                workout: w,
              })
            }
            onDelete={(w) =>
              onWorkout({
                workout: w,
                remove: true,
              })
            }
            disabled={disabled}
            pending={energyMigrationPending}
          />
        </aside>
      </div>
    </div>
  );
}
