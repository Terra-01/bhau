import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// DESIGN.md typography: Inter is the workhorse sans (mapped to --font-sans
// so shadcn/bklit components inherit it); Geist Mono sets every market
// numeral. Satoshi (display) joins when we self-host it.
const inter = Inter({
  variable: "--font-sans",
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
    <html lang="en" className={cn("h-full antialiased font-sans", inter.variable, geistMono.variable)} suppressHydrationWarning>
      {/* h-full (definite) so the war-room shell's flex sizing resolves; page
          scrolling still works below xl via html overflow. */}
      <body className="h-full flex flex-col font-sans">
        {/* Theme before first paint — no flash; dark is the default. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem("bhau-theme")==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
