import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Elyqora Free", template: "%s · Elyqora" },
  description: "A calm, connected workspace for everyday operations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
