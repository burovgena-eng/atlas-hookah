import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atlas Hookah - Система управления кальянной сетью",
  description:
    "Платформа для кальянных мастеров сети Atlas. Управление миксами, база знаний, заметки по клиентам.",
  keywords: ["Atlas", "Hookah", "Кальян", "Кальянная", "Миксы"],
  authors: [{ name: "Atlas Team" }],
  openGraph: {
    title: "Atlas Hookah",
    description:
      "Система управления кальянной сетью: миксы, рецептуры, CRM клиентов, база знаний и инвентаризация.",
    type: "website",
    locale: "ru_RU",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
