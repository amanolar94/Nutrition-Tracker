import LanguageSwitcher from "./LanguageSwitcher.jsx";
import { t } from "../i18n.js";
import { useLanguage } from "../i18n-react.jsx";
import React, { useEffect, useId, useRef } from "react";
import Icon from "./Icons.jsx";
export default function Dialog({
  title,
  onClose,
  busy = false,
  children,
  wide = false,
}) {
  useLanguage();
  const ref = useRef(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      className={`app-dialog${wide ? " dialog-wide" : ""}`}
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-header">
        <h2 id={id}>{title}</h2>
        <LanguageSwitcher />
        <button
          className="icon-button"
          aria-label={t("Κλείσιμο")}
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
