import React from "react";
import Icon from "./Icons.jsx";
export const views = [
  ["day", "Ημέρα"],
  ["week", "Εβδομάδα"],
  ["progress", "Πρόοδος"],
  ["settings", "Ρυθμίσεις"],
];
export function initialView() {
  return views.some(([key]) => key === window.location.hash.slice(1))
    ? window.location.hash.slice(1)
    : "day";
}
export default function Navigation({ view, onChange }) {
  return (
    <nav className="view-nav" aria-label="Κύρια πλοήγηση">
      <div role="tablist" aria-label="Προβολές διατροφής">
        {views.map(([key, label], i) => (
          <button
            key={key}
            role="tab"
            id={`tab-${key}`}
            aria-controls={`panel-${key}`}
            aria-selected={view === key}
            tabIndex={view === key ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={(e) => {
              const next =
                e.key === "ArrowRight"
                  ? (i + 1) % 4
                  : e.key === "ArrowLeft"
                    ? (i + 3) % 4
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? 3
                        : null;
              if (next !== null) {
                e.preventDefault();
                onChange(views[next][0]);
                document.getElementById(`tab-${views[next][0]}`).focus();
              }
            }}
          >
            <Icon name={key} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
