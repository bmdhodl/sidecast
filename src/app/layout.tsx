import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Sidecast — AI Podcast Sidebar",
  description:
    "Real-time AI commentary for live podcasts. Four personas react to your stream as you listen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geistMono.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
