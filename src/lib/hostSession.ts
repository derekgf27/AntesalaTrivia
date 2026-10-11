export const HOST_SESSION_KEY = "antesala-host-ok";
export const ADMIN_CODE_KEY = "antesala-admin-code";
export const DISPLAY_CODE_KEY = "antesala-display-code";
export const PLAYER_SESSION_KEY = "antesala-player";

export function unlockHostSession() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(HOST_SESSION_KEY, "1");
}

export function isHostUnlocked() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(HOST_SESSION_KEY) === "1";
}

export function clearHostSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(HOST_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_CODE_KEY);
}

export function rememberAdminCode(code: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ADMIN_CODE_KEY, code.toUpperCase());
}

export function clearRememberedAdminCode() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ADMIN_CODE_KEY);
}

export function getRememberedAdminCode() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ADMIN_CODE_KEY);
}

export function rememberDisplayCode(code: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DISPLAY_CODE_KEY, code.toUpperCase());
}

export function getRememberedDisplayCode() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(DISPLAY_CODE_KEY);
}

export function clearDisplaySession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DISPLAY_CODE_KEY);
}
