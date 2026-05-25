import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobBlitz AI — Auto-Apply to 100+ Jobs",
  description: "AI-powered job application automation for Indian job seekers. Auto-apply on LinkedIn and Naukri.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}