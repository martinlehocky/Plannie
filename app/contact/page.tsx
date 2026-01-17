"use client"

import { useEffect } from "react"
import Link from "next/link"

import { PrivacyTermsNote } from "@/components/privacy-terms-note"
import { useTranslations } from "@/components/language-provider"
import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"

const TALLY_IFRAME_SRC =
    "https://tally.so/embed/RGoVdv?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
const TALLY_SCRIPT_SRC = "https://tally.so/widgets/embed.js"

export default function ContactPage() {
  const { t } = useTranslations()

  useEffect(() => {
    const loadTally = () => {
      if (typeof window === "undefined") return
      // @ts-expect-error Tally is injected by the script
      if (typeof Tally !== "undefined") {
        // @ts-expect-error
        Tally.loadEmbeds()
        return
      }

      const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${TALLY_SCRIPT_SRC}"]`)
      if (existingScript) return

      const script = document.createElement("script")
      script.src = TALLY_SCRIPT_SRC
      script.async = true
      script.onload = () => {
        // @ts-expect-error
        if (typeof Tally !== "undefined") Tally.loadEmbeds()
      }
      script.onerror = () => {
        console.warn("Failed to load Tally embed script")
      }
      document.head.appendChild(script)
    }

    loadTally()
  }, [])

  return (
      <div className="min-h-screen bg-background px-4 py-16 relative">
        {/* Corner toggles (no header) */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <LanguageToggle className="w-[150px]" />
          <ThemeToggle />
        </div>

        <div className="container mx-auto max-w-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{t("contact.title")}</h1>
            <p className="text-muted-foreground">{t("contact.subtitle")}</p>
          </div>

          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="space-y-3">
              <iframe
                  data-tally-src={TALLY_IFRAME_SRC}
                  loading="lazy"
                  width="100%"
                  height="390"
                  className="w-full rounded-md border"
                  frameBorder="0"
                  marginHeight={0}
                  marginWidth={0}
                  title="Contact"
              />
              <PrivacyTermsNote />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 space-y-3">
            <p className="font-semibold">Direct contact</p>
            <div className="space-y-1 text-muted-foreground">
              <p className="font-medium text-foreground">Martin Lehocky</p>
              <p>Považská 3, Nové Mesto nad Váhom</p>
              <Link href="mailto:martinlehocky@plannie.de" className="text-primary underline underline-offset-4">
                martinlehocky@plannie.de
              </Link>
            </div>
          </div>
        </div>
      </div>
  )
}
