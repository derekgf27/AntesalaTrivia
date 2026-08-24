import type { Metadata } from "next";
import { Figtree, Outfit } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "La Antesala Trivia",
  description:
    "Live trivia nights at La Antesala — Food · Wine · Bar. Join with a code and chase the leaderboard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full`}>
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
