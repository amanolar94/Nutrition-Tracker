import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { localDate, totals, validMeal } from "./nutrition.js";
import {
  supabase,
  insertMeal,
  deleteMeal,
  updateGoals,
  loadDiary,
} from "./backend.js";
import { metrics, categories, dateLabel, number } from "./display.js";
import { summarizeWeek } from "./summaries.js";
import Auth from "./Auth.jsx";
import ChatGPTConnection from "./ChatGPTConnection.jsx";
import OAuthConsent from "./OAuthConsent.jsx";
import OAuthConnections from "./OAuthConnections.jsx";
import Navigation, { initialView } from "./components/Navigation.jsx";
import DateBar from "./components/DateBar.jsx";
import DailyView from "./components/DailyView.jsx";
import WeeklyView from "./components/WeeklyView.jsx";
import ProgressView from "./components/ProgressView.jsx";
import GoalEditor from "./components/GoalEditor.jsx";
import Dialog from "./components/Dialog.jsx";
import Icon from "./components/Icons.jsx";
import "./style.css";
const titles = {
  day: "Ημερήσια εικόνα",
  week: "Εβδομαδιαία εικόνα",
  progress: "Βάρος και πρόοδος",
  settings: "Οι ρυθμίσεις σου",
};
function App({ user, initial }) {
  const [meals, setMeals] = useState(initial.meals),
    [goals, setGoals] = useState(initial.goals),
    [weights, setWeights] = useState(initial.weights || []);
  const [date, setDate] = useState(localDate()),
    [dayType, setDayType] = useState("rest"),
    [view, setView] = useState(initialView);
  const [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [migrationPending, setMigrationPending] = useState(
      initial.migrationPending || false,
    );
  const [notice, setNotice] = useState(null),
    [lastSync, setLastSync] = useState(new Date()),
    [adding, setAdding] = useState(false),
    [deleting, setDeleting] = useState(null),
    [formError, setFormError] = useState("");
  const readVersion = useRef(0);
  function tell(text, tone = "info") {
    setNotice({ text, tone });
  }
  function apply(next) {
    setMigrationPending(next.migrationPending || false);
    setMeals(next.meals);
    setGoals(next.goals);
    setWeights(next.weights || []);
    setLastSync(new Date());
  }
  function navigate(next) {
    setView(next);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  useEffect(() => {
    const onHash = () => {
      const next = window.location.hash.slice(1);
      if (["day", "week", "progress", "settings"].includes(next)) setView(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  async function refresh() {
    if (busy || refreshing) return;
    const ticket = ++readVersion.current;
    setRefreshing(true);
    try {
      const next = await loadDiary(user.id);
      if (ticket === readVersion.current) {
        apply(next);
        setNotice(null);
      }
    } catch {
      tell(
        "Δεν έγινε ενημέρωση. Βλέπεις ακόμη τα τελευταία διαθέσιμα δεδομένα.",
        "error",
      );
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    let active = true;
    async function onFocus() {
      if (busy || document.visibilityState === "hidden") return;
      const ticket = ++readVersion.current;
      try {
        const next = await loadDiary(user.id);
        if (active && ticket === readVersion.current) apply(next);
      } catch {
        if (active)
          tell(
            "Δεν έγινε αυτόματη ενημέρωση. Δοκίμασε το κουμπί ανανέωσης.",
            "error",
          );
      }
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user.id, busy]);
  async function add(e) {
    e.preventDefault();
    if (busy || refreshing) return;
    const f = new FormData(e.currentTarget);
    const meal = {
      id: crypto.randomUUID(),
      date,
      name: f.get("name").trim(),
      category: f.get("category"),
    };
    for (const [key] of migrationPending ? metrics.slice(0, 2) : metrics)
      meal[key] = Number(f.get(key));
    if (!validMeal(meal)) {
      setFormError("Έλεγξε το όνομα και τις διατροφικές τιμές.");
      return;
    }
    ++readVersion.current;
    setBusy(true);
    setFormError("");
    try {
      await insertMeal(user.id, meal);
      setMeals((previous) => [...previous, meal]);
      setAdding(false);
      tell("Το γεύμα αποθηκεύτηκε.");
    } catch {
      setFormError(
        "Το γεύμα δεν αποθηκεύτηκε. Τα στοιχεία σου παραμένουν στη φόρμα για να δοκιμάσεις ξανά.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (busy || refreshing || !deleting) return;
    ++readVersion.current;
    setBusy(true);
    setFormError("");
    try {
      await deleteMeal(user.id, deleting.id);
      setMeals((previous) => previous.filter((m) => m.id !== deleting.id));
      setDeleting(null);
      tell("Το γεύμα διαγράφηκε.");
    } catch {
      setFormError("Δεν έγινε διαγραφή. Δοκίμασε ξανά.");
    } finally {
      setBusy(false);
    }
  }
  async function saveGoals(next) {
    if (busy || refreshing) return false;
    ++readVersion.current;
    setBusy(true);
    try {
      await updateGoals(user.id, next);
      setGoals((previous) => ({ ...previous, ...next }));
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (busy) return;
    ++readVersion.current;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch {
      tell("Η αποσύνδεση απέτυχε. Δοκίμασε ξανά.", "error");
    } finally {
      setBusy(false);
    }
  }
  const daily = meals.filter((m) => m.date === date),
    sum = totals(meals, date),
    fuel = totals(
      daily.filter((m) => m.category === "Τροφοδοσία προπόνησης"),
      date,
    ),
    weekly = summarizeWeek(meals, date),
    disabled = busy || refreshing;
  return (
    <>
      <a className="skip-link" href="#main-content">
        Μετάβαση στο περιεχόμενο
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="#day"
          aria-label="Nutrition Tracker · Ημέρα"
          onClick={(e) => {
            e.preventDefault();
            navigate("day");
          }}
        >
          <span className="brand-mark">n.</span>
          <span>
            nutrition <span className="light">tracker</span>
          </span>
        </a>
        <div className="header-actions">
          <button
            className={`icon-button ${refreshing ? "is-refreshing" : ""}`}
            aria-label="Ανανέωση"
            title="Ανανέωση δεδομένων"
            disabled={disabled}
            onClick={refresh}
          >
            <Icon name="refresh" />
          </button>
          <button
            className="account-button"
            aria-label="Λογαριασμός και ρυθμίσεις"
            onClick={() => {
              navigate("settings");
              requestAnimationFrame(() =>
                document
                  .getElementById("account-settings")
                  ?.scrollIntoView({ block: "start" }),
              );
            }}
          >
            <Icon name="user" />
          </button>
        </div>
      </header>
      <Navigation view={view} onChange={navigate} />
      <main id="main-content" tabIndex="-1">
        {notice && (
          <div
            className={`notice ${notice.tone}`}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            <span>{notice.text}</span>
            <button
              className="icon-button"
              aria-label="Κλείσιμο μηνύματος"
              onClick={() => setNotice(null)}
            >
              <Icon name="close" />
            </button>
          </div>
        )}
        {migrationPending && (
          <p role="status" className="notice">
            Κάποιες λειτουργίες δεν είναι διαθέσιμες ακόμη. Οι υπάρχουσες
            καταγραφές και οι στόχοι θερμίδων/πρωτεΐνης συνεχίζουν να
            λειτουργούν.
          </p>
        )}
        <section
          id={`panel-${view}`}
          role="tabpanel"
          aria-labelledby={`tab-${view}`}
          tabIndex="0"
        >
          <div className="page-heading">
            <div>
              <p className="eyebrow">NUTRITION TRACKER</p>
              <h1>{titles[view]}</h1>
            </div>
            <p className="sync-status" role="status">
              {refreshing
                ? "Ενημέρωση…"
                : `Ενημέρωση ${lastSync.toLocaleTimeString("el-GR", { timeZone: "Europe/Athens", hour: "2-digit", minute: "2-digit" })}`}
            </p>
          </div>
          {(view === "day" || view === "week") && (
            <DateBar date={date} onChange={setDate} weekly={view === "week"} />
          )}
          {view === "day" && (
            <DailyView
              daily={daily}
              sum={sum}
              fuel={fuel}
              date={date}
              goals={goals}
              mode={dayType}
              onMode={setDayType}
              onAdd={() => {
                setFormError("");
                setAdding(true);
              }}
              onDelete={(meal) => {
                setFormError("");
                setDeleting(meal);
              }}
              disabled={disabled}
              migrationPending={migrationPending}
            />
          )}{" "}
          {view === "week" && (
            <WeeklyView
              weekly={weekly}
              onDay={(day) => {
                setDate(day);
                navigate("day");
              }}
            />
          )}
          {view === "progress" && <ProgressView weights={weights} />}{" "}
          <div className="settings-grid" hidden={view !== "settings"}>
            <div>
              <GoalEditor
                goals={goals}
                migrationPending={migrationPending}
                busy={disabled}
                onSave={saveGoals}
              />
              {view === "settings" && (
                <section className="panel">
                  <h2>Καταγραφή μέσω ChatGPT</h2>
                  <p className="muted">
                    Περιέγραψε το γεύμα σου, έλεγξε τις εκτιμήσεις και πες
                    «καταχώρισέ το». Μόλις αποθηκευτεί, εμφανίζεται στο
                    ημερολόγιο.
                  </p>
                  <p className="data-note">
                    Οι ημερομηνίες του ημερολογίου ακολουθούν τη ζώνη ώρας
                    Europe/Athens.
                  </p>
                  <OAuthConnections />
                  <ChatGPTConnection userId={user.id} />
                </section>
              )}
            </div>
            <section id="account-settings" className="panel account-panel">
              <p className="eyebrow">ΛΟΓΑΡΙΑΣΜΟΣ</p>
              <h2>Τα στοιχεία σου</h2>
              <p className="account-email">{user.email}</p>
              <p className="muted">
                Τα δεδομένα σου αποθηκεύονται στον λογαριασμό σου και είναι
                διαθέσιμα από κάθε συσκευή.
              </p>
              <a href="/privacy.html">Πληροφορίες απορρήτου</a>
              <button className="secondary" disabled={busy} onClick={logout}>
                Αποσύνδεση
              </button>
            </section>
          </div>
        </section>
        <footer>
          Nutrition Tracker · Τα δεδομένα σου, στον λογαριασμό σου.
        </footer>
      </main>
      {adding && (
        <Dialog
          title="Χειροκίνητη καταχώριση"
          busy={busy}
          onClose={() => setAdding(false)}
        >
          <p className="muted">
            Για{" "}
            {dateLabel(date, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            . Συμπλήρωσε τις τιμές για όλο το γεύμα.
          </p>
          <form onSubmit={add}>
            <fieldset disabled={disabled}>
              <label>
                Όνομα γεύματος
                <input
                  name="name"
                  maxLength="120"
                  placeholder="π.χ. Γιαούρτι με βρώμη"
                  autoFocus
                  required
                />
              </label>
              <label>
                Κατηγορία
                <select name="category">
                  {(migrationPending ? categories.slice(0, 4) : categories).map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </label>
              <div className="pair">
                {(migrationPending ? metrics.slice(0, 2) : metrics).map(
                  ([key, label, unit]) => (
                    <label key={key}>
                      {label} ({unit})
                      <input
                        name={key}
                        type="number"
                        inputMode="decimal"
                        min={key === "calories" ? ".1" : "0"}
                        step="any"
                        required
                      />
                    </label>
                  ),
                )}
              </div>
              {formError && (
                <p className="form-feedback error" role="alert">
                  {formError}
                </p>
              )}
              <button className="primary" type="submit">
                {busy ? "Αποθήκευση…" : "Αποθήκευση γεύματος"}
              </button>
            </fieldset>
          </form>
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title="Διαγραφή γεύματος;"
          busy={busy}
          onClose={() => setDeleting(null)}
        >
          <p>
            Θα διαγραφεί το <b>{deleting.name}</b> ({number(deleting.calories)}{" "}
            kcal) από τις{" "}
            {dateLabel(deleting.date, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            . Η αλλαγή δεν αναιρείται.
          </p>
          {formError && (
            <p className="form-feedback error" role="alert">
              {formError}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Ακύρωση
            </button>
            <button className="danger" disabled={disabled} onClick={remove}>
              {busy ? "Διαγραφή…" : "Διαγραφή γεύματος"}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <Auth>
    {(user, initial) =>
      window.location.pathname === "/oauth/consent" ? (
        <OAuthConsent user={user} />
      ) : (
        <App key={user.id} user={user} initial={initial} />
      )
    }
  </Auth>,
);
