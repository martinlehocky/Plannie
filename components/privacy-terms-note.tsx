"use client"

import Link from "next/link"

import { useTranslations } from "@/components/language-provider"

interface PrivacyTermsNoteProps {
  className?: string
}

export function PrivacyTermsNote({ className = "" }: PrivacyTermsNoteProps) {
  const { t } = useTranslations()

  return (
    <p className={["text-xs text-muted-foreground text-center", className].filter(Boolean).join(" ")}>
      {t("common.privacyTermsNotice")}{" "}
      <Link href="/privacy" className="text-primary underline underline-offset-4">
        {t("common.privacy")}
      </Link>{" "}
      {t("common.and")}{" "}
      <Link href="/terms" className="text-primary underline underline-offset-4">
        {t("common.terms")}
      </Link>
      .
    </p>
  )
}
