export type Locale = "en" | "es";

export const LOCALE_STORAGE_KEY = "antesala-locale";

export function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(LOCALE_STORAGE_KEY);
  return value === "en" || value === "es" ? value : null;
}

export function applyLocale(locale: Locale) {
  document.documentElement.lang = locale;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export const localeInitScript = `(function(){try{var l=localStorage.getItem("${LOCALE_STORAGE_KEY}");if(l==="en"||l==="es"){document.documentElement.lang=l}else{document.documentElement.lang="en"}}catch(e){document.documentElement.lang="en"}})();`;

export function localeTag(locale: Locale) {
  return locale === "es" ? "es-ES" : "en-US";
}
