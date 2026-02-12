"use client"

import { Link } from "@/src/i18n/navigation"

import { useTranslations } from "next-intl"

interface PrivacyTermsNoteProps {
  className?: string
}

export function PrivacyTermsNote({ className = "" }: PrivacyTermsNoteProps) {
  const t = useTranslations("common")

  return (
    <p className={["text-xs text-muted-foreground text-center", className].filter(Boolean).join(" ")}>
      {t("privacyTermsNotice")}{" "}
      <Link href="/privacy" className="text-primary underline underline-offset-4">
        {t("privacy")}
      </Link>{" "}
      {t("and")}{" "}
      <Link href="/terms" className="text-primary underline underline-offset-4">
        {t("terms")}
      </Link>
      .
    </p>
  )
}
