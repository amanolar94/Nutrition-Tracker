import { english } from "./translations/en.js";

export const LANGUAGE_STORAGE_KEY = "nutrition-tracker-language";
export const languages = { el: "el-GR", en: "en-GB" };
const supported = (value) => Object.hasOwn(languages, value);
let currentLanguage = "el";
try {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (supported(saved)) currentLanguage = saved;
  }
} catch {
  /* Language switching still works when browser storage is unavailable. */
}
const listeners = new Set();
export const getLanguage = () => currentLanguage;
export const getLocale = (language = getLanguage()) =>
  languages[language] || languages.el;
function changeLanguage(language) {
  if (!supported(language) || language === currentLanguage) return;
  currentLanguage = language;
  for (const listener of listeners) listener();
}
export function setLanguage(language) {
  if (!supported(language)) return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* device preference is optional */
  }
  changeLanguage(language);
}
function onStorage(event) {
  if (event.key === LANGUAGE_STORAGE_KEY || event.key === null)
    changeLanguage(supported(event.newValue) ? event.newValue : "el");
}
export function subscribeLanguage(listener) {
  if (!listeners.size && typeof window !== "undefined")
    window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && typeof window !== "undefined")
      window.removeEventListener("storage", onStorage);
  };
}

// Source messages are Greek. Interpolation is plain text, never HTML or user-data translation.
export function t(message, values = {}, language = getLanguage()) {
  if (typeof message !== "string") return message;
  const key = message.trim();
  if (!key) return message;
  const translated =
    language === "en" && Object.hasOwn(english, key) ? english[key] : key;
  const result =
    message.slice(0, message.length - message.trimStart().length) +
    translated +
    message.slice(message.trimEnd().length);
  return result.replace(/\{(\w+)\}/g, (match, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}
