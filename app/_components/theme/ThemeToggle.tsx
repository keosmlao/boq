"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid icon mismatch between server-rendered (light default) and client (resolved).
  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "ປ່ຽນເປັນສະຫວ່າງ" : "ປ່ຽນເປັນມືດ"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-md",
        "text-[var(--text-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
        "transition-colors",
        className || "",
      ].join(" ")}
    >
      {mounted && theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
