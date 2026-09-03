"use client";

import { useEffect, useRef, useState } from "react";
import { MoonIcon } from "@/components/ui/moon";
import { SunIcon } from "@/components/ui/sun";

interface IconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

// Dark is the default identity; light is the designed morning variant
// (DESIGN.md). The FOUC-guard script in layout.tsx applies the stored
// choice pre-paint. The lucide-animated glyph plays on button hover.
export function ThemeToggle() {
  // null = not yet synced — render the dark-default affordance, since
  // that's what the pre-paint script showed unless "light" was stored.
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const icon = useRef<IconHandle | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const dark = theme !== "light";

  const toggle = () => {
    const next = dark ? "light" : "dark";
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
      title={dark ? "Switch to light" : "Switch to dark"}
      className="pressable flex h-6 w-6 items-center justify-center rounded-full border border-ash text-steel [@media(hover:hover)]:hover:bg-paper"
    >
      {dark ? (
        <SunIcon ref={icon} size={12} className="flex" />
      ) : (
        <MoonIcon ref={icon} size={12} className="flex" />
      )}
    </button>
  );
}
