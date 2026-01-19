import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import { LanguageProvider } from "@/components/language-provider"
import { Footer } from "@/components/footer"
import { GoogleAnalytics } from "@/components/google-analytics"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Plannie - Find the Perfect Time",
  description: "Modern group scheduling made simple",
  generator: "v0.app",
  icons: {
    icon: [
      { url: "/app-icon.png", sizes: "32x32", type: "image/png" },
      { url: "/app-icon.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/app-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
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