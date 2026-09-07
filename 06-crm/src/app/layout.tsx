import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "re:bar OS",
  description: "Операционная система сети re:bar: УК, партнёры, точки, знания",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${jetbrains.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans antialiased">
        <ThemeProvider defaultTheme="light" storageKey="rebar-os-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
