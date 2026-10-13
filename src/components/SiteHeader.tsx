"use client";

import { usePathname } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { HeaderActions } from "@/components/HeaderActions";
import { HomeHeaderActions } from "@/components/HomeHeaderActions";

export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/display") return null;

  return (
    <div className="sticky top-0 z-40 flex items-center gap-2 px-3 py-2">
      <BackButton />
      <div className="ml-auto flex items-center gap-2">
        <HomeHeaderActions />
        <HeaderActions />
      </div>
    </div>
  );
}
