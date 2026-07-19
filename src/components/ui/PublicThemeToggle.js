"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function PublicThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const resolveTheme = () => {
      const saved = localStorage.getItem("theme");
      return saved === "light" || saved === "dark"
        ? saved
        : media.matches ? "light" : "dark";
    };
    const applyTheme = () => setTheme(resolveTheme());
    const onSystemChange = () => {
      if (!localStorage.getItem("theme")) applyTheme();
    };

    applyTheme();
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", applyTheme);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", applyTheme);
    };
  }, []);

  const currentTheme = theme || "dark";
  const toggleTheme = () => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
    setTheme(nextTheme);
  };

  const label = currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      className={`public-theme-toggle ${className}`.trim()}
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      aria-pressed={currentTheme === "light"}
    >
      {currentTheme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
