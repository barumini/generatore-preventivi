import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GibusRender",
  description: "Inserisci pergole Gibus nelle foto dei cantieri",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
