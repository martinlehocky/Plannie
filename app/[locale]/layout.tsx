import type React from "react"
import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import { LanguageProvider } from "@/components/language-provider"
import { Footer } from "@/components/footer"
import { GoogleAnalytics } from "@/components/google-analytics"
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { routing, Locale } from '@/src/i18n/routing'
import { notFound } from 'next/navigation'

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
})

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const baseUrl = 'https://plannie.de'

  return {
    metadataBase: new URL(baseUrl),
    title: "Plannie",
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
      icon: [{ url: "/favicon.ico" }],
      apple: [{ url: "/favicon.ico" }],
    },
    openGraph: {
      title: "Plannie",
      description: "Modern group scheduling and daily planning made simple.",
      siteName: "Plannie",
      type: "website",
      images: [{ url: "/favicon.ico" }],
    },
    alternates: {
      canonical: locale === 'en' ? baseUrl : `${baseUrl}/${locale}`,
      languages: {
        'en': baseUrl,
        'de': `${baseUrl}/de`,
        'x-default': baseUrl,
      },
    },
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  // Validate that the incoming locale is valid
  if (!routing.locales.includes(locale as Locale)) {
    notFound()
  }

  // Enable static rendering
  setRequestLocale(locale)

  // Get messages for the current locale
  const messages = await getMessages()

  // Define the JSON-LD schema for the Site Name
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Plannie",
    "url": "https://plannie.de"
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${manrope.variable} font-sans antialiased`}>
        {/* JSON-LD Script for Google Site Name */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <NextIntlClientProvider messages={messages}>
          <LanguageProvider>
            {children}
            <Footer />
            <Toaster />
            <Analytics />
            <GoogleAnalytics />
          </LanguageProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
