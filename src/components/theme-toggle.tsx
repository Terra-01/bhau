"use client";

import { useEffect, useRef, useState } from "react";
import { MoonIcon } from "@/components/ui/moon";
import { SunIcon } from "@/components/ui/sun";

interface IconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

// Light is the identity; dark is a designed variant (DESIGN.md). The
// FOUC-guard script in layout.tsx applies the stored choice pre-paint.
// The lucide-animated glyph plays on button hover via its handle.
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const icon = useRef<IconHandle | null>(null);

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
      onMouseEnter={() => icon.current?.startAnimation()}
      onMouseLeave={() => icon.current?.stopAnimation()}
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      className="flex h-6 w-6 items-center justify-center rounded-full border border-ash text-steel transition-transform duration-150 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.94] [@media(hover:hover)]:hover:bg-paper"
    >
      {theme === "dark" ? (
        <SunIcon ref={icon} size={12} className="flex" />
      ) : (
        <MoonIcon ref={icon} size={12} className="flex" />
      )}
    </button>
  );
}
