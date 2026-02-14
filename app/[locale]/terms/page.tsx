"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "phosphor-react"
import { Button } from "@/components/ui/button"
import { PrivacyTermsNote } from "@/components/privacy-terms-note"
import { useTranslations } from "next-intl"
import { LEGAL_ENTITY } from "@/lib/legal"
import { ThemeToggle } from "@/components/theme-toggle"


export default function TermsPage() {
  const tCommon = useTranslations("common")
  const tLegal = useTranslations("legal")
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background px-4 py-16 relative">
      <div className="fixed top-4 right-6 z-50 flex items-center gap-2">
        <ThemeToggle />
      </div>
      <div className="container mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 mb-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span>{tCommon("back")}</span>
        </Button>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{tLegal("termsTitle")}</h1>
          <p className="text-muted-foreground">{tLegal("termsIntro")}</p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">1. {tLegal("termsSections.scope.title")}</h2>
            <p className="text-muted-foreground">{tLegal("termsSections.scope.body")}</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">2. {tLegal("termsSections.services.title")}</h2>
            <p className="text-muted-foreground">{tLegal("termsSections.services.body")}</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">3. {tLegal("termsSections.accounts.title")}</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>{tLegal("termsSections.accounts.items.credentials")}</li>
              <li>{tLegal("termsSections.accounts.items.content")}</li>
              <li>{tLegal("termsSections.accounts.items.abuse")}</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">4. {tLegal("termsSections.liability.title")}</h2>
            <p className="text-muted-foreground">{tLegal("termsSections.liability.body")}</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">5. {tLegal("termsSections.changes.title")}</h2>
            <p className="text-muted-foreground">{tLegal("termsSections.changes.body")}</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">6. {tLegal("termsSections.law.title")}</h2>
            <p className="text-muted-foreground">{tLegal("termsSections.law.body")}</p>
          </div>
        </div>

        <PrivacyTermsNote className="text-left" />
      </div>
    </div>
  )
}
