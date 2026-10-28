import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "./providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Docket",
  description: "Support ticket tracker",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    // Browser extensions add attributes to <html> and <body> before React hydrates (ColorZilla
    // adds cz-shortcut-listen, Grammarly data-gr-*). This ignores attribute differences on these
    // two elements only; mismatches anywhere inside are still reported.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
