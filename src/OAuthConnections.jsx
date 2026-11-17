import { t } from "./i18n.js";
import { useLanguage } from "./i18n-react.jsx";
import React, { useEffect, useState } from "react";
import { supabase } from "./backend.js";
export default function OAuthConnections() {
  useLanguage();
  const [grants, setGrants] = useState([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.oauth
      .listGrants()
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          setMessage(
            "Δεν φορτώθηκαν οι συνδεδεμένες εφαρμογές. Δοκίμασε ξανά ανοίγοντας τις Ρυθμίσεις.",
          );
        else if (Array.isArray(data)) setGrants(data);
      })
      .catch(() => {
        if (active)
          setMessage(
            "Δεν φορτώθηκαν οι συνδεδεμένες εφαρμογές. Δοκίμασε ξανά ανοίγοντας τις Ρυθμίσεις.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function revoke(clientId) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.oauth.revokeGrant({
        clientId,
      });
      if (error) throw error;
      setGrants((previous) => previous.filter((g) => g.client.id !== clientId));
      setMessage("Η πρόσβαση της εφαρμογής αφαιρέθηκε.");
    } catch {
      setMessage("Δεν αφαιρέθηκε η πρόσβαση. Δοκίμασε ξανά.");
    } finally {
      setBusy(false);
    }
  }
  if (!grants.length && !message) return null;
  return (
    <details className="connections">
      <summary>{t("Συνδεδεμένες εφαρμογές")}</summary>
      <p className="data-note">
        {t("Διαχειρίσου τις εφαρμογές που έχουν πρόσβαση στα δεδομένα σου.")}
      </p>
      {grants.map((g) => (
        <div className="grant" key={g.client.id}>
          <span>{g.client.name || t("Εφαρμογή")}</span>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => revoke(g.client.id)}
            aria-label={t("Αφαίρεση πρόσβασης {v0}", {
              v0: g.client.name || t("εφαρμογής"),
            })}
          >
            {t("Αφαίρεση πρόσβασης")}
          </button>
        </div>
      ))}
      {message && (
        <p role="status" className="data-note">
          {t(message)}
        </p>
      )}
    </details>
  );
}
