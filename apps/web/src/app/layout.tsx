import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppHeader } from "@/shared/components/AppHeader";

import styles from "./layout.module.css";
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
    <html lang="en">
      <body>
        <Providers>
          <AppHeader />
          <main className={styles.main}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
