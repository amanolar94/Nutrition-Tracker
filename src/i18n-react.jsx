import { useSyncExternalStore } from "react";
import { getLanguage, subscribeLanguage } from "./i18n.js";
export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, getLanguage, () => "el");
}
