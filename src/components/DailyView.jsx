import React from "react";
import { metrics, number, budgetLabel, categories } from "../display.js";
import { totals } from "../nutrition.js";
import Icon from "./Icons.jsx";
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
  onDelete,
  disabled,
  migrationPending,
}) {
  const target = (key) => goals[mode === "rest" ? key : `training_${key}`],
    incomplete = daily.some((m) => m.carbs == null || m.fat == null);
  return (
    <div className="day-grid">
      <div className="daily-overview">
        <section className="energy-card stat" data-metric="calories">
          <div className="section-title">
            <h2>Θερμίδες ημέρας</h2>
            <label className="target-selector">
              <span className="sr-only">Σύγκριση με στόχους</span>
              <select
                aria-label="Στόχοι ημέρας"
                value={mode}
                disabled={migrationPending}
                onChange={(e) => onMode(e.target.value)}
              >
                <option value="rest">Ανάπαυσης</option>
                <option value="training">Προπόνησης</option>
              </select>
            </label>
          </div>
          <div className="energy-value">
            <strong>{number(sum.calories)}</strong>
            <span>kcal</span>
          </div>
          <div className="energy-goal">
            Στόχος <b>{number(target("calories"))} kcal</b>
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
                στόχος {number(target(key))} g
              </span>
              <Meter
                value={sum[key]}
                target={target(key)}
                label={`Πρόοδος ${label.toLowerCase()}`}
              />
            </article>
          ))}
        </section>
        {incomplete && (
          <p className="data-note" role="status">
            Κάποια γεύματα έχουν άγνωστους υδατάνθρακες ή λιπαρά. Τα αντίστοιχα
            σύνολα είναι ελλιπή.
          </p>
        )}
        {daily.some((m) => m.category === "Τροφοδοσία προπόνησης") && (
          <details className="fueling">
            <summary>
              <Icon name="fuel" />
              <span>Τροφοδοσία προπόνησης</span>
              <b>{number(fuel.calories)} kcal</b>
            </summary>
            <dl className="nutrition-list">
              {metrics.slice(1).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{number(fuel[key])} g</dd>
                </div>
              ))}
            </dl>
            <p className="data-note">Περιλαμβάνεται ήδη στα ημερήσια σύνολα.</p>
          </details>
        )}
      </div>
      <section className="panel diary">
        <div className="section-title">
          <div>
            <p className="eyebrow">
              ΗΜΕΡΟΛΟΓΙΟ · {daily.length}{" "}
              {daily.length === 1 ? "ΓΕΥΜΑ" : "ΓΕΥΜΑΤΑ"}
            </p>
            <h2>Τα γεύματά σου</h2>
          </div>
          <button
            className="secondary compact"
            aria-label="Χειροκίνητη προσθήκη"
            title="Χειροκίνητη προσθήκη"
            onClick={onAdd}
            disabled={disabled}
          >
            <Icon name="plus" />
            <span className="manual-label">Προσθήκη</span>
          </button>
        </div>
        {daily.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="meal" width="28" height="28" />
            </div>
            <h3>Δεν υπάρχουν γεύματα ακόμη</h3>
            <p>
              Κατάγραψε το γεύμα σου στο ChatGPT και επιβεβαίωσε την αποθήκευση.
              Θα εμφανιστεί εδώ.
            </p>
            <button className="text-button" disabled={disabled} onClick={onAdd}>
              Ή πρόσθεσέ το χειροκίνητα
            </button>
          </div>
        ) : (
          categories.map((category) => {
            const records = daily.filter((m) => m.category === category);
            if (!records.length) return null;
            return (
              <section className="meal-group" key={category}>
                <div className="group-title">
                  <h3>{category}</h3>
                  <span>{number(totals(records, date).calories)} kcal</span>
                </div>
                <ul>
                  {records.map((m) => (
                    <li className="meal-card" key={m.id}>
                      <div className="meal-top">
                        <h4>{m.name}</h4>
                        <div className="meal-energy">
                          <strong>{number(m.calories)}</strong>
                          <span>kcal</span>
                        </div>
                        <button
                          className="icon-button delete"
                          disabled={disabled}
                          onClick={() => onDelete(m)}
                          aria-label={`Διαγραφή ${m.name}`}
                        >
                          <Icon name="trash" />
                        </button>
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
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </section>
    </div>
  );
}
