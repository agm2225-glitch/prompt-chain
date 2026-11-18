"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const modes = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div role="group" aria-label="Color theme" className="inline-flex rounded-md border border-line bg-surface p-0.5 text-xs">
      {modes.map((m) => {
        const active = mounted && theme === m.id;
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(m.id)}
            className={`rounded px-2.5 py-1 font-medium cursor-pointer ${
              active ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
