"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "phosphor-react"
import { Button } from "@/components/ui/button"
import { PrivacyTermsNote } from "@/components/privacy-terms-note"
import { useTranslations } from "next-intl"
import { LEGAL_ENTITY } from "@/lib/legal"
import { ThemeToggle } from "@/components/theme-toggle"

export default function PrivacyPage() {
  const tCommon = useTranslations("common")
  const tLegal = useTranslations("legal")
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background px-4 py-16 relative">
      {/* Corner toggle (theme only, language is in footer) */}
      <div className="fixed top-4 right-6 z-50 flex items-center gap-2">
        <ThemeToggle />
      </div>

      <div className="container mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 mb-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span>{tCommon("back")}</span>
        </Button>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{tLegal("privacyTitle")}</h1>
          <p className="text-muted-foreground">{tLegal("privacyIntro")}</p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">1. {tLegal("privacySections.responsible.title")}</h2>
            <div className="text-muted-foreground">
              <p className="font-medium">{LEGAL_ENTITY.name}</p>
              <a className="text-primary underline underline-offset-4" href={`mailto:${LEGAL_ENTITY.email}`}>
                {LEGAL_ENTITY.email}
              </a>
              <p>{tLegal("privacySections.responsible.body")}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">2. {tLegal("privacySections.data.title")}</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>{tLegal("privacySections.data.items.account")}</li>
              <li>{tLegal("privacySections.data.items.event")}</li>
              <li>{tLegal("privacySections.data.items.technical")}</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">3. {tLegal("privacySections.usage.title")}</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>{tLegal("privacySections.usage.items.service")}</li>
              <li>{tLegal("privacySections.usage.items.emails")}</li>
              <li>{tLegal("privacySections.usage.items.fraud")}</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">4. {tLegal("privacySections.thirdParties.title")}</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>{tLegal("privacySections.thirdParties.brevo")}</li>
              <li>{tLegal("privacySections.thirdParties.recaptcha")}</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              <a
                className="text-primary underline underline-offset-4"
                href="https://www.brevo.com/legal/privacypolicy/"
                rel="noreferrer"
                target="_blank"
              >
                Brevo Privacy Policy
              </a>{" · "}
              <a
                className="text-primary underline underline-offset-4"
                href="https://policies.google.com/privacy"
                rel="noreferrer"
                target="_blank"
              >
                Google Privacy Policy
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">5. {tLegal("privacySections.cookies.title")}</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>{tLegal("privacySections.cookies.items.essential")}</li>
              <li>{tLegal("privacySections.cookies.items.localStorage")}</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">6. {tLegal("privacySections.rights.title")}</h2>
            <p className="text-muted-foreground">{tLegal("privacySections.rights.body")}</p>
          </div>
        </div>

        <PrivacyTermsNote className="text-left" />
      </div>
    </div>
  )
}
