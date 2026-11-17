import { t } from "../i18n.js";
import { useLanguage } from "../i18n-react.jsx";
import React from "react";
import { number, dateLabel } from "../display.js";
export default function ProgressView({ weights }) {
  useLanguage();
  const latest = weights.at(-1),
    first = weights[0],
    delta = latest && first ? latest.weight_kg - first.weight_kg : 0,
    min = Math.min(...weights.map((w) => w.weight_kg)),
    max = Math.max(...weights.map((w) => w.weight_kg)),
    span = Math.max(1, max - min),
    start = first ? new Date(first.date).getTime() : 0,
    end = latest ? new Date(latest.date).getTime() : 0;
  const points = weights
    .map(
      (w) =>
        `${16 + (248 * (new Date(w.date).getTime() - start)) / Math.max(1, end - start)},${116 - (80 * (w.weight_kg - min)) / span}`,
    )
    .join(" ");
  return (
    <>
      <section className="panel weight-current">
        <p className="eyebrow">{t("ΤΕΛΕΥΤΑΙΑ ΜΕΤΡΗΣΗ")}</p>
        {latest ? (
          <>
            <strong>
              {number(latest.weight_kg)} <span>kg</span>
            </strong>
            <p>
              {dateLabel(latest.date, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            {weights.length > 1 && (
              <div className="weight-change">
                {delta > 0 ? "+" : ""}
                {number(delta)}
                {t(" kg από την πρώτη καταγεγραμμένη μέτρηση")}
              </div>
            )}
          </>
        ) : (
          <div className="empty">
            <h2>{t("Ξεκίνα την παρακολούθηση βάρους")}</h2>
            <p>
              {t(
                "Πες στο ChatGPT το βάρος και την ημερομηνία σου και επιβεβαίωσε την καταγραφή.",
              )}
            </p>
          </div>
        )}
      </section>
      {weights.length > 1 && (
        <section className="panel weight-chart">
          <h2>{t("Πορεία βάρους")}</h2>
          <p className="muted">
            {t("Καταγεγραμμένες μετρήσεις · ")}
            {number(min)}
            {t(" έως ")}
            {number(max)} kg
          </p>
          <svg
            viewBox="0 0 280 140"
            role="img"
            aria-label={t("Πορεία από {v0} σε {v1} κιλά", {
              v0: number(first.weight_kg),
              v1: number(latest.weight_kg),
            })}
          >
            <path
              d="M16 116H264M16 36H264"
              stroke="#e1e9e7"
              strokeDasharray="3 5"
            />
            <polyline
              points={points}
              fill="none"
              stroke="#1f7a68"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {weights.map((w, i) => {
              const [cx, cy] = points.split(" ")[i].split(",");
              return <circle key={w.id} cx={cx} cy={cy} r="3" fill="#1f7a68" />;
            })}
          </svg>
          <div className="chart-dates">
            <span>
              {dateLabel(first.date, {
                day: "numeric",
                month: "short",
              })}
            </span>
            <span>
              {dateLabel(latest.date, {
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
        </section>
      )}
      <section className="panel weight-history">
        <h2>{t("Οι μετρήσεις σου")}</h2>
        {weights.length ? (
          <ul>
            {weights
              .slice(-30)
              .reverse()
              .map((w) => (
                <li key={w.id}>
                  <time dateTime={w.date}>
                    {dateLabel(w.date, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                  <b>{number(w.weight_kg)} kg</b>
                </li>
              ))}
          </ul>
        ) : (
          <p className="muted">{t("Δεν έχουν αποθηκευτεί μετρήσεις ακόμη.")}</p>
        )}
        {weights.length > 30 && (
          <p className="data-note">
            {t("Εμφανίζονται οι τελευταίες 30 μετρήσεις.")}
          </p>
        )}
        <p className="data-note">
          {t(
            "Αρχικό βάρος αναφοράς: 100 kg. Η μεταβολή υπολογίζεται από τις πραγματικές καταγραφές σου.",
          )}
        </p>
      </section>
    </>
  );
}
