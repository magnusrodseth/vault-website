import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pensieve",
  description:
    "Your AI-powered second brain. Examine your thoughts at leisure.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pensieve",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "apple-mobile-web-app-title": "Pensieve",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <main id="main-content">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
