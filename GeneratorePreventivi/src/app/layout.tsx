import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generatore preventivi — DIH Vicenza",
  description: "Sistema di gestione preventivi DIH Vicenza",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
