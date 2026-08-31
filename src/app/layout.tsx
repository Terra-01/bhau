import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

// DESIGN.md typography: Inter is the workhorse; Geist Mono sets every
// market numeral. Satoshi (display) joins when we self-host it — Inter 500
// with tight tracking is the documented substitute until then.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bhau — the Indian market war room",
  description:
    "A customizable India-market intelligence dashboard whose AI paper-trading agents prove its usefulness daily. Paper capital only. Not investment advice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
