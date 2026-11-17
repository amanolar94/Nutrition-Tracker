import React from "react";
import { useLanguage } from "../i18n-react.jsx";
import { setLanguage, t } from "../i18n.js";
export default function LanguageSwitcher() {
  const language = useLanguage();
  const target = language === "el" ? "en" : "el";
  const label =
    target === "en"
      ? t("Αλλαγή γλώσσας σε Αγγλικά")
      : t("Αλλαγή γλώσσας σε Ελληνικά");
  return (
    <button
      type="button"
      className="language-button secondary"
      aria-label={label}
      title={label}
      onClick={() => setLanguage(target)}
    >
      <span lang={target}>{target === "en" ? "EN" : "EL"}</span>
    </button>
  );
}
