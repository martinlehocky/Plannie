"use client"

import { PrivacyTermsNote } from "@/components/privacy-terms-note"
import { useTranslations } from "@/components/language-provider"

export default function PrivacyPage() {
  const { t } = useTranslations()

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="container mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t("legal.privacyTitle")}</h1>
          <p className="text-muted-foreground">{t("legal.privacyPlaceholder")}</p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-3">
          <p className="font-semibold">{t("legal.todoTitle")}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("legal.todoData")}</li>
            <li>{t("legal.todoRights")}</li>
            <li>{t("legal.todoCookies")}</li>
            <li>{t("legal.todoUpdates")}</li>
          </ul>
        </div>

        <PrivacyTermsNote className="text-left" />
      </div>
    </div>
  )
}
