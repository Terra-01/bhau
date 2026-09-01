"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

// Light is the identity; dark is a designed variant (DESIGN.md). The
// FOUC-guard script in layout.tsx applies the stored choice pre-paint.
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("bhau-theme", next);
    } catch {
      /* private mode */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      className="flex h-6 w-6 items-center justify-center rounded-full border border-ash text-steel transition-transform duration-150 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.94] [@media(hover:hover)]:hover:bg-paper"
    >
      {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
    </button>
  );
}
