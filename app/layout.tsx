import type React from "react"
import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import { LanguageProvider } from "@/components/language-provider"
import { Footer } from "@/components/footer"
import { GoogleAnalytics } from "@/components/google-analytics"
import "./globals.css"

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://plannie.de'),

  title: "Plannie - Find the Perfect Time",
  description: "Effortlessly organize your daily tasks, schedule group events, and boost productivity. Plannie is the modern, simple calendar planner for everyone.",
  generator: "v0.app",
  applicationName: "Plannie",
  keywords: [
    "calendar planner",
    "daily schedule",
    "time management",
    "group scheduling",
    "meeting finder",
    "productivity app",
    "online agenda",
    "event organizer",
    "team calendar",
    "personal planner",
    "time blocking",
    "schedule maker",
    "availability tracker"
  ],
  icons: {
    icon: [
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/favicon.ico" },
    ],
  },
  openGraph: {
    title: "Plannie - Find the Perfect Time",
    description: "Modern group scheduling and daily planning made simple.",
    siteName: "Plannie",
    type: "website",
    images: [{ url: "/favicon.ico" }],
  },
}

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode
}>) {
  return (
      <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} font-sans antialiased`}>
      <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var stored = localStorage.getItem("language");
    var nav = navigator.language || (navigator.languages && navigator.languages[0]) || "";
    var lang = stored === "de" ? "de" : (nav && nav.toLowerCase().startsWith("de") ? "de" : "en");
    document.documentElement.lang = lang;
  } catch (_) {
    document.documentElement.lang = "en";
  }
})();`,
          }}
      />
      <LanguageProvider>
        {children}
        <Footer />
        <Toaster />
        <Analytics />
        <GoogleAnalytics />
      </LanguageProvider>
      </body>
      </html>
  )
}
