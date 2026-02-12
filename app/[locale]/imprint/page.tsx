"use client"

import { useRouter } from "next/navigation"
import { Link } from "@/src/i18n/navigation"
import { ArrowLeft } from "phosphor-react"
import { Button } from "@/components/ui/button"
import { PrivacyTermsNote } from "@/components/privacy-terms-note"
import { useTranslations } from "next-intl"
import { LEGAL_ENTITY } from "@/lib/legal"
import { ThemeToggle } from "@/components/theme-toggle"

export default function ImprintPage() {
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
          <h1 className="text-3xl font-bold">{tLegal("imprintTitle")}</h1>
          <p className="text-muted-foreground">{tLegal("imprintPlaceholder")}</p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">{tLegal("imprintNameLabel")}</p>
            <p className="text-base font-medium">{LEGAL_ENTITY.name}</p>
          </div>

          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">{tLegal("imprintContactLabel")}</p>
            <Link href={`mailto:${LEGAL_ENTITY.email}`} className="text-primary underline underline-offset-4">
              {LEGAL_ENTITY.email}
            </Link>
          </div>
        </div>

        <PrivacyTermsNote className="text-left" />
      </div>
    </div>
  )
}
