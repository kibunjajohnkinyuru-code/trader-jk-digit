import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trader JK — Digit Analysis Tool",
  description: "Deriv digit analysis tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
  }
