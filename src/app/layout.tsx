import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LevelUpOverlay } from "@/components/rewards/LevelUpOverlay";
import { LiveAnnouncer } from "@/components/rewards/LiveAnnouncer";
import { XpToasts } from "@/components/rewards/XpToasts";
import { AppShell } from "@/components/shell/AppShell";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { GlobalShortcuts } from "@/components/shell/GlobalShortcuts";
import { Providers } from "@/components/shell/Providers";
import { ServiceWorker } from "@/components/shell/ServiceWorker";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "DataCommand · OCR Data Analytics revision", template: "%s · DataCommand" },
  description:
    "Active-recall revision for the Cambridge OCR Level 3 Advanced National in IT: Data Analytics (F200–F206): SM-2 spaced-repetition flashcards, OCR-style exam practice with mark schemes, and mastery analytics. Works offline.",
  applicationName: "DataCommand",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "DataCommand", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#090b10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>
          <AppShell>{children}</AppShell>
          <CommandPalette />
          <LevelUpOverlay />
          <XpToasts />
          <LiveAnnouncer />
          <GlobalShortcuts />
          <ServiceWorker />
        </Providers>
      </body>
    </html>
  );
}
