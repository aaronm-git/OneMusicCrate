"use client";

import { MoonStarIcon, SunMediumIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <Button
      aria-label="Toggle color theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      size="icon"
      variant="outline"
    >
      {isDark ? <SunMediumIcon /> : <MoonStarIcon />}
    </Button>
  );
}
