import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "re:bar Hub",
  description: "Операционная система франшизы re:bar",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${jetbrains.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans antialiased">
        <ThemeProvider defaultTheme="light" storageKey="rebar-hub-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
