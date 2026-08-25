"use client";

import { usePathname } from "next/navigation";
import { HomeHostButton } from "@/components/HomeHostButton";

export function HomeHeaderActions() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return <HomeHostButton />;
}
