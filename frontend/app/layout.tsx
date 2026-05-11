import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JobBlitz AI — Auto-Apply to 100+ Jobs",
  description: "AI-powered job application automation for Indian job seekers. Auto-apply on LinkedIn and Naukri.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-[family-name:var(--font-inter)]`}>
        {children}
      </body>
    </html>
  );
}