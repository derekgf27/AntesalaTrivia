"use client";

import { usePathname } from "next/navigation";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";

export function HeaderActions() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <LanguageToggle />
      <ThemeToggle />
    </div>
  );
}
