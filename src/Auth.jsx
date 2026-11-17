import LanguageSwitcher from "./components/LanguageSwitcher.jsx";
import { t } from "./i18n.js";
import { useLanguage } from "./i18n-react.jsx";
import React, { useEffect, useState } from "react";
import { supabase, loadDiary } from "./backend.js";
import { loginErrorMessage, diaryErrorMessage } from "./authErrors.js";
export default function Auth({ children }) {
  useLanguage();
  const [session, setSession] = useState(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [diary, setDiary] = useState(null),
    [loadError, setLoadError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (active) {
        setSession(s);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        if (error) setMessage("Δεν ήταν δυνατή η ανάκτηση της σύνδεσης.");
        setSession(data.session);
        setReady(true);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const consentPage = window.location.pathname === "/oauth/consent";
  useEffect(() => {
    let active = true;
    setDiary(null);
    setLoadError(false);
    if (session && !consentPage)
      loadDiary(session.user.id)
        .then((data) => {
          if (active) setDiary(data);
        })
        .catch((error) => {
          if (active) setLoadError(diaryErrorMessage(error));
        });
    return () => {
      active = false;
    };
  }, [session?.user.id, retry, consentPage]);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: f.get("email").trim(),
        password: f.get("password"),
      });
      if (error) setMessage(loginErrorMessage(error));
    } catch {
      setMessage("Δεν υπάρχει σύνδεση με την υπηρεσία. Δοκίμασε ξανά.");
    } finally {
      setBusy(false);
    }
  }
  if (!supabase)
    return (
      <main className="auth">
        <div className="auth-language">
          <LanguageSwitcher />
        </div>
        <section className="panel">
          <h1>Nutrition Tracker</h1>
          <p>{t("Η σύνδεση λογαριασμών δεν έχει ενεργοποιηθεί ακόμη.")}</p>
          <p className="muted">
            {t(
              "Μόλις ολοκληρωθεί η ρύθμιση, θα μπορείς να αποθηκεύεις τα γεύματά σου στον λογαριασμό σου.",
            )}
          </p>
        </section>
      </main>
    );
  if (!ready)
    return (
      <main role="status">
        <div className="auth-language">
          <LanguageSwitcher />
        </div>
        {t("Έλεγχος σύνδεσης…")}
      </main>
    );
  if (session && consentPage) return children(session.user, null);
  if (session) {
    if (loadError)
      return (
        <main className="auth">
          <div className="auth-language">
            <LanguageSwitcher />
          </div>
          <p role="alert">{t(loadError)}</p>
          <button onClick={() => setRetry((n) => n + 1)}>
            {t("Επανάληψη")}
          </button>
          <button onClick={() => supabase.auth.signOut()}>
            {t("Αποσύνδεση")}
          </button>
        </main>
      );
    if (!diary)
      return (
        <main role="status">
          <div className="auth-language">
            <LanguageSwitcher />
          </div>
          {t("Φόρτωση ημερολογίου…")}
        </main>
      );
    return children(session.user, diary);
  }
  return (
    <main className="auth">
      <div className="auth-language">
        <LanguageSwitcher />
      </div>
      <section className="panel">
        <p className="eyebrow">NUTRITION TRACKER</p>
        <h1>{t("Καλώς ήρθες")}</h1>
        <p className="muted">
          {t("Τα γεύματα και οι στόχοι σου, μαζί σου σε κάθε συσκευή.")}
        </p>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              {t("Κωδικός")}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit">
              {busy ? t("Περίμενε…") : t("Σύνδεση")}
            </button>
          </fieldset>
        </form>
        {message && <p role="status">{t(message)}</p>}
      </section>
    </main>
  );
}
