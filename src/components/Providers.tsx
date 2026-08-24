"use client";

import { GameProvider } from "@/lib/socket/GameProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <GameProvider>{children}</GameProvider>;
}
