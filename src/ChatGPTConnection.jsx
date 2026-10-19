import React, { useEffect, useState } from "react";
import { supabase } from "./backend.js";

// Historical key metadata only. No key generation or Action setup remains.
export default function LegacyActionKeys({ userId }) {
  const [keys, setKeys] = useState([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    supabase
      .from("chatgpt_keys")
      .select("id,name,created_at,expires_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage("Δεν φορτώθηκαν τα παλιά κλειδιά σύνδεσης.");
        else setKeys(data);
      })
      .catch(() => {
        if (active) setMessage("Δεν φορτώθηκαν τα παλιά κλειδιά σύνδεσης.");
      });
    return () => {
      active = false;
    };
  }, [userId]);
  async function remove(id) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase
        .from("chatgpt_keys")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      setKeys((previous) => previous.filter((k) => k.id !== id));
      setMessage("Το παλιό κλειδί διαγράφηκε.");
    } catch {
      setMessage("Το παλιό κλειδί δεν διαγράφηκε. Δοκίμασε ξανά.");
    } finally {
      setBusy(false);
    }
  }
  if (!keys.length && !message) return null;
  return (
    <details className="panel chatgpt">
      <summary>Παλιά κλειδιά σύνδεσης</summary>
      <p className="muted">
        Η σύνδεση με προσωπικά κλειδιά έχει αποσυρθεί. Η σύνδεση Nutrition
        Tracker στο ChatGPT χρησιμοποιεί OAuth. Μπορείς να διαγράψεις τα παλιά
        κλειδιά χωρίς να επηρεαστεί η σύνδεση MCP.
      </p>
      {keys.length > 0 && (
        <ul>
          {keys.map((k) => (
            <li key={k.id}>
              <div>
                <h3>{k.name}</h3>
                <small>
                  Δημιουργία:{" "}
                  {new Date(k.created_at).toLocaleDateString("el-GR", {
                    timeZone: "Europe/Athens",
                  })}
                </small>
              </div>
              <button
                disabled={busy}
                onClick={() => remove(k.id)}
                aria-label={`Διαγραφή παλιού κλειδιού ${k.name}`}
              >
                Διαγραφή
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
