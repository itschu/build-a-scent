import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthModal } from "@/components/auth/auth-modal";
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
  title: "Build a Scent",
  description: "Blend rare ingredients into a fragrance that is uniquely yours.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <AuthModal />
      </body>
    </html>
  );
}
