import LanguageSwitcher from "./components/LanguageSwitcher.jsx";
import { t } from "./i18n.js";
import { useLanguage } from "./i18n-react.jsx";
import React, { useEffect, useState } from "react";
import { supabase } from "./backend.js";
export default function OAuthConsent({ user }) {
  useLanguage();
  const id = new URLSearchParams(window.location.search).get(
    "authorization_id",
  );
  const [details, setDetails] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function redirect(url) {
    const dest = new URL(url);
    if (
      dest.protocol !== "https:" &&
      !(
        dest.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(dest.hostname)
      )
    )
      throw Error("Invalid redirect");
    window.location.assign(dest.href);
  }
  useEffect(() => {
    let active = true;
    if (!id) {
      setError(
        "Λείπει το αίτημα εξουσιοδότησης. Ξεκίνα τη σύνδεση από το ChatGPT.",
      );
      return;
    }
    supabase.auth.oauth
      .getAuthorizationDetails(id)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        if (data?.redirect_url) {
          redirect(data.redirect_url);
          return;
        }
        setDetails(data);
      })
      .catch(() => {
        if (active)
          setError(
            "Το αίτημα εξουσιοδότησης δεν είναι διαθέσιμο ή έχει λήξει. Ξεκίνα ξανά από το ChatGPT.",
          );
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function decide(approve) {
    setBusy(true);
    try {
      const { data, error } = await (approve
        ? supabase.auth.oauth.approveAuthorization(id, {
            skipBrowserRedirect: true,
          })
        : supabase.auth.oauth.denyAuthorization(id, {
            skipBrowserRedirect: true,
          }));
      if (error || !data?.redirect_url)
        throw error || Error("Missing redirect");
      redirect(data.redirect_url);
    } catch {
      setError("Η εξουσιοδότηση απέτυχε. Δοκίμασε ξανά.");
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <div className="auth-language">
        <LanguageSwitcher />
      </div>
      <section className="panel">
        <h1>{t("Σύνδεση Nutrition Tracker")}</h1>
        <p>{user.email}</p>
        {error ? (
          <p role="alert">{t(error)}</p>
        ) : !details ? (
          <p role="status">{t("Φόρτωση αιτήματος…")}</p>
        ) : (
          <>
            <h2>
              {details.client?.name ||
                details.client?.client_name ||
                t("Εξωτερική εφαρμογή")}
            </h2>
            <p>
              {t(
                "Η εφαρμογή ζητά πρόσβαση στα δικά σου γεύματα, σύνολα, βάρη και στόχους. Οι αλλαγές MCP αποθηκεύονται απευθείας μετά από τη ρητή επιβεβαίωσή σου στο ChatGPT.",
              )}
            </p>
            <p className="muted">
              Scopes: {details.scope || t("Δεν αναφέρονται")}
            </p>
            <div className="pair">
              <button disabled={busy} onClick={() => decide(false)}>
                {t("Απόρριψη")}
              </button>
              <button disabled={busy} onClick={() => decide(true)}>
                {t("Έγκριση πρόσβασης")}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
