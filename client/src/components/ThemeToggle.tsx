import { useState } from "react";
import { applyTheme, getStoredTheme, type ThemeChoice } from "../lib/theme";

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemeChoice, string> = { system: "Theme: Auto", light: "Theme: Light", dark: "Theme: Dark" };

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(() => getStoredTheme());

  function cycle() {
    const next = NEXT[choice];
    applyTheme(next);
    setChoice(next);
  }

  return (
    <button className="btn theme-toggle" type="button" onClick={cycle}>
      {LABEL[choice]}
    </button>
  );
}
