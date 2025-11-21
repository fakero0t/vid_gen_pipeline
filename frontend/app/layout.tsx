import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { PerformanceMonitor } from "@/components/PerformanceMonitor";
import { ClerkProvider } from "@clerk/nextjs";
import { Navbar } from "@/components/Navbar";
import { layoutClasses } from "@/lib/layout";

// Modern sans-serif for body text - clean and readable
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Bold display font for headings - Mockupper-inspired
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "AI Video Pipeline",
  description: "AI-powered video generation pipeline that turns your product vision into stunning vertical videos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
        <body
          className={`antialiased font-sans ${layoutClasses.fullScreen}`}
        >
          <PerformanceMonitor />
          <Navbar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
