"use client"

import Link from "next/link"

import { PrivacyTermsNote } from "@/components/privacy-terms-note"
import { useTranslations } from "@/components/language-provider"
import { LEGAL_ENTITY } from "@/lib/legal"

export default function ImprintPage() {
  const { t } = useTranslations()

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="container mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t("legal.imprintTitle")}</h1>
          <p className="text-muted-foreground">{t("legal.imprintPlaceholder")}</p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">{t("legal.imprintNameLabel")}</p>
            <p className="text-base font-medium">{LEGAL_ENTITY.name}</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">{t("legal.imprintAddressLabel")}</p>
            <p className="text-base font-medium">{LEGAL_ENTITY.address}</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">{t("legal.imprintContactLabel")}</p>
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
