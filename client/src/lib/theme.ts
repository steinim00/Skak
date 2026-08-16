export type ThemeChoice = "system" | "light" | "dark";

const STORAGE_KEY = "skak.theme";

export function getStoredTheme(): ThemeChoice {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

/** The theme actually in effect right now — resolves "system" against the
 * OS/browser preference. */
export function effectiveTheme(): "light" | "dark" {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** White pawn for the light theme, black pawn for the dark theme — matches
 * the theme's own name to the piece color shown in the browser tab. */
export function updateFavicon() {
  const theme = effectiveTheme();
  const href = `${import.meta.env.BASE_URL}${theme === "light" ? "favicon-pawn-white.svg" : "favicon-pawn-black.svg"}`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = href;
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  localStorage.setItem(STORAGE_KEY, choice);
  updateFavicon();
}

/** Call once on startup: applies the stored theme choice and keeps the
 * favicon in sync if the OS-level preference changes while "system" is
 * selected. */
export function initTheme() {
  applyTheme(getStoredTheme());
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getStoredTheme() === "system") updateFavicon();
  });
}
